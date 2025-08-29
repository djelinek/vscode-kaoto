import { QuickPickItem, window } from 'vscode';
import { AbstractNewCamelRouteCommand } from './AbstractNewCamelRouteCommand';
import { CitrusInitJBangTask } from '../tasks/CitrusInitJBangTask';
import path from 'path';
import { Uri } from 'vscode';
import { commands } from 'vscode';
import { CitrusJBang } from '../helpers/CitrusJBang';

export class NewCitrusTestCommand extends AbstractNewCamelRouteCommand {
	public static readonly ID_COMMAND_CAMEL_ROUTE = 'kaoto.citrus.jbang.init.test';
	protected static readonly PROGRESS_NOTIFICATION_MESSAGE = 'Creating a new Citrus Test file...';

	public async create(): Promise<void> {
		const dslPick = await this.showQuickPickForCitrusTestType();
		if (!dslPick) {
			return;
		}
		const wsFolder = await this.showWorkspaceFolderPick();
		if (wsFolder || this.singleWorkspaceFolder) {
			const targetFolder = await this.showDialogToPickFolder(wsFolder?.uri);
			if (targetFolder) {
				const name = await this.showInputBoxForFileName(targetFolder ? targetFolder.fsPath : undefined);
				if (name && this.singleWorkspaceFolder) {
					const fileName = this.getFullName(name, dslPick.label.toLowerCase());
					const filePath = this.computeFullPath(targetFolder.fsPath, fileName);

					const wsFolderTarget = wsFolder || this.singleWorkspaceFolder;
					await new CitrusInitJBangTask(
						wsFolderTarget,
						path.relative(wsFolderTarget.uri.fsPath, filePath),
						new CitrusJBang().init(fileName),
					).executeAndWaitWithProgress(NewCitrusTestCommand.PROGRESS_NOTIFICATION_MESSAGE);
					const targetFileURI = Uri.file(filePath);
					await this.waitForFileExists(targetFileURI);
					await commands.executeCommand('vscode.open', targetFileURI);
				}
			}
		} else {
			await this.showNoWorkspaceNotification();
		}
	}

	protected async showInputBoxForFileName(targetFolder?: string): Promise<string> {
		const input = await window.showInputBox({
			prompt: this.fileNameInputPrompt,
			placeHolder: 'Please provide a name for the new test file (without extension).',
			validateInput: (fileName) => {
				return this.validateCitrusFileName(fileName ?? '', targetFolder);
			},
		});
		return input ?? '';
	}

	protected async validateCitrusFileName(name: string, folderPath?: string): Promise<string | undefined> {
		if (!name) {
			return 'Please provide a name for the new file (without extension).';
		}
		if (name.includes('.')) {
			return 'Please provide a name without the extension.';
		}
		return undefined;
	}

	protected computeFullPath(folderPath: string, fileName: string): string {
		return path.join(folderPath, fileName);
	}

	protected getFullName(name: string, suffix: string): string {
		return `${name}.${suffix}`;
	}

	private async showQuickPickForCitrusTestType(): Promise<QuickPickItem | undefined> {
		const items: QuickPickItem[] = [
			{ label: 'YAML', description: 'Citrus Test using YAML DSL' },
			{ label: 'XML', description: 'Citrus Test using XML DSL' },
			{ label: 'Java', description: 'Citrus Test using Java DSL' },
		];
		return await window.showQuickPick(items, {
			placeHolder: 'Please select a Citrus Test type.',
			title: 'Citrus Test type selection...',
		});
	}
}
