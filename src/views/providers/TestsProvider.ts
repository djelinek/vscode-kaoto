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
import { commands, TreeItem, Uri } from 'vscode';
import { AbstractFolderTreeProvider } from './AbstractFolderTreeProvider';
import { Test } from '../testTreeItems/Test';
import { TestFolder } from '../testTreeItems/TestFolder';

export class TestsProvider extends AbstractFolderTreeProvider<TestFolder> {
	private static readonly FILE_PATTERN = '{**/*.citrus.yaml,**/*IT.yaml,**/*test.yaml}';
	private static readonly EXCLUDE_PATTERN = '{**/node_modules/**,**/.vscode/**,**/out/**,**/.citrus-jbang*/**,**/target/**,**/.mvn/**}';

	/** Cache of file paths to Test items for efficient lookup and single-item refresh */
	private readonly testItemCache: Map<string, Test> = new Map();

	constructor() {
		super();
		this.initFileWatcher();
	}

	protected getFilePattern(): string {
		return TestsProvider.FILE_PATTERN;
	}

	protected getExcludePattern(): string {
		return TestsProvider.EXCLUDE_PATTERN;
	}

	protected createFolderItem(name: string, folderUri: Uri, isUnderMavenRoot: boolean, isMavenRoot: boolean, isWorkspaceRoot: boolean = false): TestFolder {
		return new TestFolder(name, folderUri, isUnderMavenRoot, isMavenRoot, isWorkspaceRoot);
	}

	protected async toTreeItemForFile(file: Uri, _isUnderMavenRoot: boolean, _isTopLevelWithinWorkspace: boolean): Promise<TreeItem> {
		// Check if we have a cached item for this file
		const cachedTest = this.testItemCache.get(file.fsPath);
		if (cachedTest) {
			return cachedTest;
		}

		// Create new test item and cache it
		const test = new Test(file);
		this.testItemCache.set(file.fsPath, test);
		return test;
	}

	protected isFolderItem(element: TreeItem): element is TestFolder {
		return element instanceof TestFolder;
	}

	protected setContext(hasFiles: boolean): void {
		commands.executeCommand('setContext', 'kaoto.testExists', hasFiles);
	}

	/**
	 * Override refresh to clear the cache when a full refresh is triggered
	 */
	refresh(): void {
		this.testItemCache.clear();
		super.refresh();
	}

	/**
	 * Set the running state for a test and refresh only that item
	 * @param filePath The file path of the test
	 * @param running Whether the test is running
	 */
	setTestRunning(filePath: string, running: boolean): void {
		const testItem = this.testItemCache.get(filePath);
		if (testItem) {
			// Update the running state on the cached item
			testItem.setRunning(running);
			// Refresh only this specific item
			this._onDidChangeTreeData.fire(testItem);
		} else {
			// Fallback: if item not in cache, do a full refresh
			// This shouldn't normally happen if the test was already displayed
			this.refresh();
		}
	}

	/**
	 * Refresh a specific test item
	 * @param test The test item to refresh
	 */
	refreshItem(test: Test): void {
		this._onDidChangeTreeData.fire(test);
	}
}
