import {spawn} from 'child_process';
import {Request, Response} from "express";
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';

export default class Command {
  scriptsPath: string;

  constructor(scriptsPath: string) {
    this.scriptsPath = scriptsPath;
  }

  /**
 * Execute the script from the given script path.
 *
 * @param scriptPath
 */
  execScript(scriptPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fs.exists(scriptPath, exists => {
        if (exists) {
          let child = spawn('sh', [scriptPath]);

          child.stdout.on('data', data => {
            resolve(data.toString());
          })

          child.stderr.on('data', data => {
            reject('There was an error executing the script');
          });
        }
        else {
          reject('The script you want to execute does not exist');
        }
      });
    });
  };

  /**
   * Returns the files in the path that start with the given prefix
   *
   * @param path
   * @param prefix
   */
  getFilesWithPrefix(path: string, prefix: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(path, (err, files) => {
        if (err) {
          reject('The path does not exist');
        }
        else {
          resolve(_.filter(files, file => file.startsWith(prefix)));
        }
      });
    });
  };

  /**
   * Handle command execution errors by sending a JSON response.
   *
   * @param res
   * @param err
   */
  handleCommandError(res: Response, err: NodeJS.ErrnoException) {
    res.json({
      response: err.message,
      error: true
    });
  };

  /**
   * Handle the execution of a single command.
   *
   * @param res
   * @param scriptName
   */
  handleSingleCommand(res: Response, scriptName: string) {
    let scriptPath = path.join(this.scriptsPath, scriptName + '.sh');

    this.execScript(scriptPath)
      .then(output => {
        res.json({
          response: output,
          error: false
        });
      })
      .catch(err => {
        this.handleCommandError(res, err);
      });
  };

  /**
   * Handle the execution of a group of commands.
   *
   * @param res
   * @param scriptGroup
   */
  handleGroupCommand(res: Response, scriptGroup: string) {
    this.getFilesWithPrefix(this.scriptsPath, scriptGroup)
      .then(files => {
        let execs: Promise<string>[] = [];

        // Aggregate the exections into an array of promises
        _.forEach(files, file => {
          let scriptPath = path.join(this.scriptsPath, file);
          execs.push(this.execScript(scriptPath));
        });

        // Process all executions at once and send the response to the client
        Promise.all(execs)
          .then(execResults => {
            res.json({
              response: execResults,
              error: false
            });
          })
          .catch(err => {
            this.handleCommandError(res, err);
          });
      })
      .catch(err => {
        this.handleCommandError(res, err);
      });
  };
}