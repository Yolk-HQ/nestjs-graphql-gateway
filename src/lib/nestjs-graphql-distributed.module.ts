import { printSchema } from '@apollo/federation';
import { DynamicModule, Inject, Module, OnModuleInit, Optional, Provider } from '@nestjs/common';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { HttpAdapterHost } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import {
  GqlModuleAsyncOptions,
  GqlOptionsFactory,
  GraphQLAstExplorer,
} from '@nestjs/graphql';
import { GRAPHQL_MODULE_ID, GRAPHQL_MODULE_OPTIONS } from '@nestjs/graphql/dist/graphql.constants';
import { DelegatesExplorerService } from '@nestjs/graphql/dist/services/delegates-explorer.service';
import { ResolversExplorerService } from '@nestjs/graphql/dist/services/resolvers-explorer.service';
import { ScalarsExplorerService } from '@nestjs/graphql/dist/services/scalars-explorer.service';
import { extend } from '@nestjs/graphql/dist/utils/extend.util';
import { generateString } from '@nestjs/graphql/dist/utils/generate-token.util';
import { mergeDefaults } from '@nestjs/graphql/dist/utils/merge-defaults.util';
import { ApolloServerBase } from 'apollo-server-core';

import { GraphqlDistributedFactory } from './graphql-distributed.factory';
import { FedGraphQLSchemaBuilder } from './graphql-schema-builder';
import { GraphQLTypesLoader } from './graphql-types.loader';
import { FedGqlModuleOptions } from './interfaces';
import { ReferencesExplorerService } from './services';

@Module({
  providers: [
    GraphqlDistributedFactory,
    MetadataScanner,
    ResolversExplorerService,
    DelegatesExplorerService,
    ScalarsExplorerService,
    ReferencesExplorerService,
    GraphQLAstExplorer,
    GraphQLTypesLoader,
    FedGraphQLSchemaBuilder,
  ],
  exports: [GraphQLTypesLoader, GraphQLAstExplorer],
})
export class GraphqlDistributedModule implements OnModuleInit {
  public static forRoot(options: FedGqlModuleOptions = {}): DynamicModule {
    options = mergeDefaults(options);
    return {
      module: GraphqlDistributedModule,
      providers: [
        {
          provide: GRAPHQL_MODULE_OPTIONS,
          useValue: options,
        },
      ],
    };
  }

  public static forRootAsync(options: GqlModuleAsyncOptions): DynamicModule {
    return {
      module: GraphqlDistributedModule,
      imports: options.imports,
      providers: [
        ...this.createAsyncProviders(options),
        {
          provide: GRAPHQL_MODULE_ID,
          useValue: generateString(),
        },
      ],
    };
  }

  private static createAsyncProviders(
    options: GqlModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    return [
      this.createAsyncOptionsProvider(options),
      // @ts-ignore
      {
        provide: options.useClass,
        useClass: options.useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: GqlModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: GRAPHQL_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    // @ts-ignore
    return {
      provide: GRAPHQL_MODULE_OPTIONS,
      useFactory: (optionsFactory: GqlOptionsFactory) => optionsFactory.createGqlOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }

  private apolloServer: ApolloServerBase | undefined;

  constructor(
    @Optional()
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(GRAPHQL_MODULE_OPTIONS)
    private readonly options: FedGqlModuleOptions,
    private readonly graphqlDistributedFactory: GraphqlDistributedFactory,
    private readonly graphqlTypesLoader: GraphQLTypesLoader,
  ) {}

  public async onModuleInit() {
    if (!this.httpAdapterHost) {
      return;
    }
    const {httpAdapter} = this.httpAdapterHost;

    if (!httpAdapter) {
      return;
    }

    const typeDefs =
      (await this.graphqlTypesLoader.mergeTypesByPaths(
        this.options.typePaths,
      )) || [];

    const mergedTypeDefs = extend(typeDefs, this.options.typeDefs);
    const apolloOptions = await this.graphqlDistributedFactory.mergeOptions({
      ...this.options,
      typeDefs: mergedTypeDefs,
    });

    if (this.options.definitions && this.options.definitions.path) {
      await this.graphqlDistributedFactory.generateDefinitions(
        // @ts-ignore
        printSchema(apolloOptions.schema),
        this.options,
      );
    }

    const adapterName = httpAdapter.constructor && httpAdapter.constructor.name;

    if (adapterName === 'ExpressAdapter') {
      this.registerExpress(apolloOptions);
    } else if (adapterName === 'FastifyAdapter') {
      this.registerFastify(apolloOptions);
    } else {
      throw new Error(`No support for current HttpAdapter: ${adapterName}`);
    }

    if (this.options.installSubscriptionHandlers) {
      // TL;DR <https://github.com/apollographql/apollo-server/issues/2776>
      throw new Error('No support for subscriptions yet');
      /*this.apolloServer.installSubscriptionHandlers(
        httpAdapter.getHttpServer(),
      );*/
    }
  }


  private registerExpress(apolloOptions: any) {
    const { ApolloServer } = loadPackage(
      'apollo-server-express',
      'GraphQLModule',
      () => require('apollo-server-express'),
    );

    const {
      path,
      disableHealthCheck,
      onHealthCheck,
      cors,
      bodyParserConfig,
    } = this.options;

    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();

    const apolloServer = new ApolloServer(apolloOptions as any);

    apolloServer.applyMiddleware({
      app,
      path,
      disableHealthCheck,
      onHealthCheck,
      cors,
      bodyParserConfig,
    });

    this.apolloServer = apolloServer;
  }

  private registerFastify(apolloOptions: any) {
    const { ApolloServer } = loadPackage(
      'apollo-server-fastify',
      'GraphQLModule',
      () => require('apollo-server-fastify'),
    );

    const {
      path,
      disableHealthCheck,
      onHealthCheck,
      cors,
      bodyParserConfig,
    } = this.options;

    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();

    // const path = this.getNormalizedPath(apolloOptions);

    const apolloServer = new ApolloServer(apolloOptions as any);

    app.register(
      apolloServer.createHandler({
        path,
        disableHealthCheck,
        onHealthCheck,
        cors,
        bodyParserConfig,
      }),
    );

    this.apolloServer = apolloServer;
  }

  /* private getNormalizedPath(apolloOptions: DistributedModuleOptions): string {
    const prefix = this.applicationConfig.getGlobalPrefix();
    const useGlobalPrefix = prefix && this.options.useGlobalPrefix;
    const gqlOptionsPath = normalizeRoutePath(apolloOptions.path);
    return useGlobalPrefix
      ? normalizeRoutePath(prefix) + gqlOptionsPath
      : gqlOptionsPath;
  } */

}
