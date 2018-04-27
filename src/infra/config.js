import path from "path";
import {deepFreeze} from "./utils";

//TODO support more than just config file
/*
Source:
- from config file        {"section": {"name": "value"}}
- from command line args  -section.name=value
- from env                NODE_SECTION_NAME=value

Q:
- how do we parse type (simple or complex) from cmd and env?
*/
export function loadConfig(configFilePath) {
  const config = require(path.resolve(configFilePath));
  return deepFreeze(config);
}