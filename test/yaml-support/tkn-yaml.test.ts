/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { TektonYamlType, DeclaredTask, tektonYaml, pipelineYaml, pipelineRunYaml } from '../../src/yaml-support/tkn-yaml';

const expect = chai.expect;
chai.use(sinonChai);

suite('Tekton yaml', () => {

  suite('Tekton detection', () => {
    test('Should detect Pipeline', () => {

      const yaml = `
            apiVersion: tekton.dev/v1alpha1
            kind: Pipeline
            metadata:
              name: pipeline-with-parameters
            spec:
              params:
                - name: context
                  type: string
                  description: Path to context
                  default: /some/where/or/other
              tasks:
                - name: build-skaffold-web
                  taskRef:
                    name: build-push
                  params:
                    - name: pathToDockerFile
                      value: Dockerfile
                    - name: pathToContext
                      value: "$(params.context)"
            `
      const tknType = tektonYaml.isTektonYaml({ getText: () => yaml, version: 1, uri: vscode.Uri.parse('file:///foo/bar.yaml') } as vscode.TextDocument);
      expect(tknType).is.not.undefined;
      expect(tknType).to.equals(TektonYamlType.Pipeline);
    });

    test('Should not detect if kind not Pipeline', () => {
      const yaml = `
            apiVersion: tekton.dev/v1alpha1
            kind: PipeFoo
            metadata:
              name: pipeline-with-parameters
            spec:
              params:
                - name: context
                  type: string
                  description: Path to context
                  default: /some/where/or/other
              tasks:
                - name: build-skaffold-web
                  taskRef:
                    name: build-push
                  params:
                    - name: pathToDockerFile
                      value: Dockerfile
                    - name: pathToContext
                      value: "$(params.context)"
            `
      const tknType = tektonYaml.isTektonYaml({ getText: () => yaml, version: 1, uri: vscode.Uri.parse('file:///foo/NotBar.yaml') } as vscode.TextDocument);
      expect(tknType).is.undefined;
    });

    test('"getTektonDocuments" should provide documents by type (Pipeline)', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/multitype.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 1, uri: vscode.Uri.parse('file:///foo/multitype.yaml') } as vscode.TextDocument, TektonYamlType.Pipeline);
      expect(docs).is.not.undefined;
      expect(docs).not.empty;
      expect(docs.length).be.equal(1);
    });

    test('"getTektonDocuments" should provide documents by type (PipelineResource)', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/multitype.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 2, uri: vscode.Uri.parse('file:///foo/multitype.yaml') } as vscode.TextDocument, TektonYamlType.PipelineResource);
      expect(docs).is.not.undefined;
      expect(docs).not.empty;
      expect(docs.length).be.equal(4);
    });

    test('"getTektonDocuments" should return empty if no type match', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/multitype.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 2, uri: vscode.Uri.parse('file:///foo/multitype.yaml') } as vscode.TextDocument, TektonYamlType.PipelineRun);
      expect(docs).is.not.undefined;
      expect(docs).is.empty;
    });

    test('"getTektonDocuments" should return undefined if yaml', () => {
      const docs = tektonYaml.getTektonDocuments({ getText: () => 'Some string', version: 2, uri: vscode.Uri.parse('file:///foo/multitype.yaml') } as vscode.TextDocument, TektonYamlType.PipelineRun);
      expect(docs).is.not.undefined;
      expect(docs).is.empty;
    });

    test('"getMetadataName" should return name', () => {
      const yaml = `
            apiVersion: tekton.dev/v1alpha1
            kind: Pipeline
            metadata:
              name: pipeline-with-parameters
            `;
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml, version: 1, uri: vscode.Uri.parse('file:///name/pipeline.yaml') } as vscode.TextDocument, TektonYamlType.Pipeline);
      const name = tektonYaml.getMetadataName(docs[0]);
      expect(name).to.be.equal('pipeline-with-parameters');
    });

    test('"getPipelineTasks" should return tasks description', () => {
      const yaml = `
      apiVersion: tekton.dev/v1alpha1
      kind: Pipeline
      metadata:
        name: pipeline-with-parameters
      spec:
        tasks:
          - name: build-skaffold-web
            taskRef:
              name: build-push
            params:
              - name: pathToDockerFile
                value: Dockerfile
              - name: pathToContext
                value: "$(params.context)"
            runAfter:
              - fooTask
      `
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml, version: 1, uri: vscode.Uri.parse('file:///tasks/pipeline.yaml') } as vscode.TextDocument, TektonYamlType.Pipeline);
      const tasks = pipelineYaml.getPipelineTasks(docs[0]);
      expect(tasks).is.not.empty;
      const task = tasks[0];
      expect(task.kind).to.equal('Task');
      expect(task.name).equal('build-skaffold-web');
      expect(task.taskRef).equal('build-push');
      expect(task.runAfter).to.eql(['fooTask']);

    });

    test('"getPipelineTasks" should return "from" statement', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/pipeline-ordering.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 2, uri: vscode.Uri.parse('file:///ordering/multitype.yaml') } as vscode.TextDocument, TektonYamlType.Pipeline);
      const tasks = pipelineYaml.getPipelineTasks(docs[0]);
      const task = tasks.find(t => t.name === 'deploy-web');
      expect(task.runAfter).eql(['build-skaffold-web']);
    });

    test('"getPipelineTasks" should return "from" statement from conditions', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/conditional-pipeline.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 2, uri: vscode.Uri.parse('file:///ordering/conditional-pipeline.yaml') } as vscode.TextDocument, TektonYamlType.Pipeline);
      const tasks = pipelineYaml.getPipelineTasks(docs[0]);
      const task = tasks.find(t => t.name === 'then-check');
      expect(task.runAfter).eql(['first-create-file']);
    });

    test('"getPipelineTasks" should return "from" statement from conditions', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/conditional-pipeline.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 2, uri: vscode.Uri.parse('file:///ordering/conditional-pipeline.yaml') } as vscode.TextDocument, TektonYamlType.Pipeline);
      const tasks = pipelineYaml.getPipelineTasks(docs[0]);
      const task = tasks.find(t => t.name === 'then-check');
      expect(task.conditions).eql(['file-exists']);
    });
  });

  suite('Tekton tasks detections', () => {
    test('should return Tekton tasks ref names', () => {
      const yaml = `
            apiVersion: tekton.dev/v1alpha1
            kind: Pipeline
            metadata:
              name: pipeline-with-parameters
            spec:
              tasks:
                - name: build-skaffold-web
                  taskRef:
                    name: build-push
                  params:
                    - name: pathToDockerFile
                      value: Dockerfile
                    - name: pathToContext
                      value: "$(params.context)"
            `
      const pipelineTasks = pipelineYaml.getPipelineTasksRefName({ getText: () => yaml, version: 1, uri: vscode.Uri.parse('file:///foo/pipeline/tasks.yaml') } as vscode.TextDocument);
      expect(pipelineTasks).is.not.empty;
      expect(pipelineTasks).to.eql(['build-push']);
    });

    test('should return empty array if no tasks defined', () => {
      const yaml = `
            apiVersion: tekton.dev/v1alpha1
            kind: Pipeline
            metadata:
              name: pipeline-with-parameters
            spec:
              tasks:
            `
      const pipelineTasks = pipelineYaml.getPipelineTasksRefName({ getText: () => yaml, version: 1, uri: vscode.Uri.parse('file:///foo/pipeline/empty/tasks.yaml') } as vscode.TextDocument);
      expect(pipelineTasks).is.empty;
    });

    test('should return tekton pipeline tasks names', () => {
      const yaml = `
          apiVersion: tekton.dev/v1alpha1
          kind: Pipeline
          metadata:
            name: pipeline-with-parameters
          spec:
            tasks:
              - name: build-skaffold-web
                taskRef:
                  name: build-push
                params:
                  - name: pathToDockerFile
                    value: Dockerfile
                  - name: pathToContext
                    value: "$(params.context)"
          `
      const pipelineTasks = pipelineYaml.getPipelineTasksName({ getText: () => yaml, version: 1, uri: vscode.Uri.parse('file:///foo/pipeline/tasks.yaml') } as vscode.TextDocument);
      expect(pipelineTasks).is.not.empty;
      expect(pipelineTasks).to.eql(['build-skaffold-web']);
    });
  });

  suite('Tekton Declared resource detection', () => {
    test('Should return declared pipeline resources', () => {
      const yaml = `
            apiVersion: tekton.dev/v1alpha1
            kind: Pipeline
            metadata:
              name: build-and-deploy
            spec:
              resources:
                - name: api-repo
                  type: git
                - name: api-image
                  type: image
            
              tasks:
                - name: build-api
                  taskRef:
                    name: buildah
                    kind: ClusterTask
                  resources:
                    inputs:
                      - name: source
                        resource: api-repo
                    outputs:
                      - name: image
                        resource: api-image
                  params:
                    - name: TLSVERIFY
                      value: "false"
            `;

      const pipelineResources = pipelineYaml.getDeclaredResources({ getText: () => yaml, version: 1, uri: vscode.Uri.parse('file:///foo/pipeline/resources.yaml') } as vscode.TextDocument);
      expect(pipelineResources).is.not.empty;
      expect(pipelineResources).to.eql([{ name: 'api-repo', type: 'git' }, { name: 'api-image', type: 'image' }]);
    });
  });
  suite('PipelineRun', () => {
    test('should return pipelinerun tasks', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/pipelinerun.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 1, uri: vscode.Uri.parse('file:///pipelinerun/pipelinerun.yaml') } as vscode.TextDocument, TektonYamlType.PipelineRun);
      const tasks: DeclaredTask[] = [
        {
          name: 'build',
          kind: '',
          taskRef: 'buildRef',
          runAfter: []
        },
        {
          name: 'deploy',
          kind: '',
          taskRef: 'buildRef',
          runAfter: []
        }
      ];
      const result = pipelineRunYaml.addPipelineRunTasks(docs[0], tasks);
      expect(result).is.not.undefined;
      expect(result).length(2);
      expect(result[0].state).eq('Finished');
      expect(result[0].startTime).eq('2020-03-30T08:03:42Z');
      expect(result[0].completionTime).eq('2020-03-30T08:05:50Z');
      expect(result[1].state).eq('Failed');
    });

    test('should return pipelinerun tasks', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/pipelinerun.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 1, uri: vscode.Uri.parse('file:///pipelinerun/pipelinerun.yaml') } as vscode.TextDocument, TektonYamlType.PipelineRun);
      const tasks: DeclaredTask[] = [
        {
          name: 'build',
          kind: '',
          taskRef: 'buildRef',
          runAfter: []
        },
      ];
      const result = pipelineRunYaml.addPipelineRunTasks(docs[1], tasks);
      expect(result).length(1);
      expect(result[0].state).eq('Started');
    });

    test('should return pipelinerun tasks canceled state', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/pipelinerun.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 1, uri: vscode.Uri.parse('file:///pipelinerun/pipelinerun.yaml') } as vscode.TextDocument, TektonYamlType.PipelineRun);
      const tasks: DeclaredTask[] = [
        {
          name: 'build-image',
          kind: '',
          taskRef: 'buildRef',
          runAfter: []
        },
      ];
      const result = pipelineRunYaml.addPipelineRunTasks(docs[2], tasks);
      expect(result).length(1);
      expect(result[0].state).eq('Cancelled');
    });

    test('should return pipelinerun name', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/pipelinerun.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 1, uri: vscode.Uri.parse('file:///pipelinerun/pipelinerun.yaml') } as vscode.TextDocument, TektonYamlType.PipelineRun);

      const result = pipelineRunYaml.getPipelineRunName(docs[0]);
      expect(result).eql('nodejs-ex-git-twbd85-nlhww');
    });

    test('should return pipelinerun state', async () => {
      const yaml = await fs.readFile(path.join(__dirname, '..', '..', '..', 'test', '/yaml-support/pipelinerun.yaml'));
      const docs = tektonYaml.getTektonDocuments({ getText: () => yaml.toString(), version: 1, uri: vscode.Uri.parse('file:///pipelinerun/pipelinerun.yaml') } as vscode.TextDocument, TektonYamlType.PipelineRun);

      const result = pipelineRunYaml.getPipelineRunStatus(docs[0]);
      expect(result).eql('Failed');
    });
  });
});
