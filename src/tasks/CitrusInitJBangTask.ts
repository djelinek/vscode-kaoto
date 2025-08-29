import { CamelJBangTask } from './CamelJBangTask';
import { WorkspaceFolder, TaskScope, TaskRevealKind } from 'vscode';
import { ShellExecution } from 'vscode';

export class CitrusInitJBangTask extends CamelJBangTask {
	constructor(scope: WorkspaceFolder | TaskScope.Workspace, label: string, shellExecution: ShellExecution) {
		super(scope, label, shellExecution, true, TaskRevealKind.Silent);
	}
}
