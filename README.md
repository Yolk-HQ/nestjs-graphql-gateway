# NestJs GraphQL Gateway (supports type-graphql)

<p align="center">
  NestJS GraphQL Apollo Federation extension. You keep using @nestjs/graphql for all other steps
</p>

<p align="center">
<a href="https://www.npmjs.com/package/nestjs-graphql-gateway" target="_blank"><img src="https://img.shields.io/npm/v/nestjs-graphql-gateway?style=flat-square" alt="NPM Version"/></a>
<a href="https://img.shields.io/github/license/juicycleff/nestjs-graphql-gateway?style=flat-square" target="_blank"><img src="https://img.shields.io/github/license/juicycleff/nestjs-graphql-gateway?style=flat-square" alt="License"/></a>
<a href="https://img.shields.io/github/languages/code-size/juicycleff/nestjs-graphql-gateway?style=flat-square" target="_blank"><img src="https://img.shields.io/github/languages/code-size/juicycleff/nestjs-graphql-gateway?style=flat-square" alt="Code Size"/></a>
<a href="https://img.shields.io/github/languages/top/juicycleff/nestjs-graphql-gateway?style=flat-square" target="_blank"><img src="https://img.shields.io/github/languages/top/juicycleff/nestjs-graphql-gateway?style=flat-square" alt="Top Language"/></a>
<a href="https://img.shields.io/codacy/grade/81314c5a5cb04baabe3eb5262b859288?style=flat-square" target="_blank"><img src="https://img.shields.io/codacy/grade/dc460840375d4ac995f5647a5ed10179?style=flat-square" alt="Top Language"/></a>
</p>

## Why?

This fork was created to provide an instance of this library that removes the `temp__` property from the `Query` fields as it is no longer required. This fork enables the consumer to federate multiple services, without this the `temp__` field with collide preventing services from booting.

## Installation

```bash
$ yarn install nestjs-graphql-gateway
```

## Setup federated service

```typescript
import { Module } from '@nestjs/common';
import { GraphqlDistributedModule } from 'nestjs-graphql-gateway';

@Module({
  imports: [
    GraphqlDistributedModule.forRoot({
      typePaths: [path.join(process.cwd() + '/apps/service-auth/src', '/**/*.graphql')],
      introspection: true,
      playground: {
        workspaceName: 'GRAPHQL CQRS',
        settings: {
          'editor.theme': 'light',
        },
      },
      context: (ctx) => ctx,
    })
  ]
})
export class AppModule {}


// Code first TypegraphQl

@Module({
  imports: [
    GraphqlDistributedModule.forRoot({
      autoSchemaFile: 'graphs/demo.gql',

      // optional orphaned types
      buildSchemaOptions: {
        orphanedTypes: [Tenant, TenantMember, User],
      },

      context: (ctx) => ctx,
    })
  ]
})
export class AppModule {}
```

## Setup Gateway

```typescript
import { Module } from '@nestjs/common';
import { GraphqlDistributedGatewayModule } from 'nestjs-graphql-gateway';

@Module({
  imports: [
    GraphqlDistributedGatewayModule.forRoot({
      subscriptions: false,
      path: '/graphql',
      context: context => context,
      serviceList: [
        { name: 'auth', url: 'http://localhost:1000/graphql' },
        { name: 'user', url: 'http://localhost:2000/graphql' },
        // more services
      ],
      buildService({ url }) {
        return new HeadersDatasource({ url });
      },
    }),
  ]
})
export class AppModule {}
```

## License

This project is [MIT licensed](LICENSE).
