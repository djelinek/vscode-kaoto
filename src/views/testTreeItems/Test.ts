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
import { basename } from 'path';
import { TreeItem, TreeItemCollapsibleState, Uri, ThemeIcon } from 'vscode';

export class Test extends TreeItem {
	private static readonly CONTEXT_TEST_FILE = 'citrus-test-file';
	private static readonly CONTEXT_TEST_FILE_RUNNING = 'citrus-test-file-running';

	private _isRunning: boolean = false;

	constructor(public readonly fileUri: Uri) {
		super(basename(fileUri.fsPath), TreeItemCollapsibleState.None);
		this.resourceUri = fileUri;
		this.tooltip = fileUri.fsPath;
		this.iconPath = ThemeIcon.File;
		this.command = { command: 'vscode.open', title: 'Open with Editor', arguments: [fileUri] };
		this.contextValue = Test.CONTEXT_TEST_FILE;
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	/**
	 * Set the running state of the test
	 * @param running Whether the test is running
	 */
	setRunning(running: boolean): void {
		this._isRunning = running;
		if (running) {
			this.iconPath = new ThemeIcon('sync~spin');
			this.contextValue = Test.CONTEXT_TEST_FILE_RUNNING;
			this.description = 'Running...';
		} else {
			this.iconPath = ThemeIcon.File;
			this.contextValue = Test.CONTEXT_TEST_FILE;
			this.description = undefined;
		}
	}
}
