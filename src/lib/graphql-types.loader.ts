import { Injectable } from '@nestjs/common';
import * as glob from 'fast-glob';
import * as fs from 'fs';
import { flatten } from 'lodash';
import { mergeTypes } from 'merge-graphql-schemas';
import * as util from 'util';

const readFile = util.promisify(fs.readFile);

@Injectable()
export class GraphQLTypesLoader {
  public async mergeTypesByPaths(paths: string | string[]) {
    if (!paths || paths.length === 0) {
      return null;
    }

    const types = await this.getTypesFromPaths(paths);
    const flatTypes = flatten(types);
    return mergeTypes([...flatTypes], { all: true });
  }

  public async getTypesFromPaths(paths: string | string[]): Promise<string[]> {
    const filePaths = await glob.sync(paths, {
      ignore: ['node_modules'],
    });
    const fileContentsPromises = filePaths.map((filePath) => {
      return readFile(filePath.toString(), 'utf8');
    });

    return Promise.all(fileContentsPromises);
  }
}
