import fs from "fs";
import esClient from "node-eventstore-client";
import {resolvePath} from "./utils";

export default class FileCheckpointStore {
  constructor(filePath) {
    this._filePath = resolvePath(filePath);
  }
  get() {
    return new Promise((resolve, reject) => {
      fs.readFile(this._filePath, (err, content) => {
        if (err && err.code === 'ENOENT') return resolve(esClient.positions.start);
        if (err) return reject(err);
        try {
          const obj = JSON.parse(content.toString());
          resolve(new esClient.Position(obj.commitPosition, obj.preparePosition));
        } catch (e) {
          reject(e);
        }
      });
    });
  }
  put(position) {
    return new Promise((resolve, reject) => {
      if (!position) return resolve();
      const json = JSON.stringify(position);
      fs.writeFile(this._filePath, json, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}
