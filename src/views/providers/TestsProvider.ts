/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Event, EventEmitter, FileSystemWatcher, TreeDataProvider, TreeItem, workspace } from 'vscode';
import { Test } from '../testTreeItems/Test';

type TreeItemType = TreeItem | undefined | null | void;

export class TestsProvider implements TreeDataProvider<TreeItem> {
	private readonly _onDidChangeTreeData: EventEmitter<TreeItemType> = new EventEmitter<TreeItemType>();
	readonly onDidChangeTreeData: Event<TreeItemType> = this._onDidChangeTreeData.event;

	private static readonly FILE_PATTERN =
		'{**/*.citrus.xml,**/*.citrus.yaml,**/*.citrus.java,**/*IT.yaml,**/*IT.xml,**/*IT.java,**/*test.yaml,**/*test.xml,**/*test.java}';
	private static readonly EXCLUDE_PATTERN = '{**/node_modules/**,**/.vscode/**,**/out/**,**/.citrus-jbang*/**,**/target/**}';
	private readonly fileWatcher: FileSystemWatcher;

	constructor() {
		this.fileWatcher = workspace.createFileSystemWatcher(TestsProvider.FILE_PATTERN);
		this.fileWatcher.onDidChange(this.refresh.bind(this));
		this.fileWatcher.onDidCreate(this.refresh.bind(this));
		this.fileWatcher.onDidDelete(this.refresh.bind(this));
	}

	dispose(): void {
		this._onDidChangeTreeData.dispose();
		this.fileWatcher.dispose();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	async getChildren(): Promise<TreeItem[]> {
		const testFiles = await this.getTestAvailableInWorkspace();
		if (testFiles.length > 0) {
			return testFiles;
		}
		return [];
	}

	private async getTestAvailableInWorkspace(): Promise<TreeItem[]> {
		const testFiles = await workspace.findFiles(TestsProvider.FILE_PATTERN, TestsProvider.EXCLUDE_PATTERN);
		return testFiles.map((file) => {
			return new Test(file);
		});
	}
}
