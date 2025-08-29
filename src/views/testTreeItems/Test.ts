import { basename, dirname, relative } from 'path';
import { TreeItem, TreeItemCollapsibleState, Uri, ThemeIcon, workspace } from 'vscode';

export class Test extends TreeItem {
	constructor(file: Uri) {
		super(basename(file.fsPath), TreeItemCollapsibleState.None);
		this.tooltip = file.fsPath;
		this.iconPath = ThemeIcon.File;
		this.resourceUri = file;
		this.description = this.getDescription(this.resourceUri);
		this.command = { command: 'vscode.open', title: 'Open with Editor', arguments: [file] };
		this.contextValue = 'citrus-test-file';
	}

	private getDescription(filepath: Uri): string {
		if (workspace.workspaceFolders && workspace.workspaceFolders.length > 1) {
			return dirname(relative(dirname(workspace.getWorkspaceFolder(filepath)?.uri.fsPath as string), filepath.fsPath));
		} else {
			return dirname(relative(workspace.getWorkspaceFolder(filepath)?.uri.fsPath as string, filepath.fsPath));
		}
	}
}
