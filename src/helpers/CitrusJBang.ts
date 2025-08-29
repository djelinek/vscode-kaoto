import { ShellExecution, workspace } from 'vscode';
import { execSync } from 'child_process';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';

export class CitrusJBang {
	private readonly camelJBangVersion: string;
	private readonly defaultJbangArgs: string[];

	constructor(private readonly jbang: string = 'jbang') {
		this.camelJBangVersion = workspace.getConfiguration().get('kaoto.camelJBang.Version') as string;
		this.defaultJbangArgs = [`'-Dcamel.jbang.version=${this.camelJBangVersion}'`, 'citrus@citrusframework/citrus'];
	}

	public init(file: string, directory?: string): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'init', `'${file}'`, directory ? `-dir='${directory}'` : '']);
	}

	/**
	 * Retrieve all available Citrus test types/templates from Citrus JBang CLI.
	 * Attempts to call `init --list` and parse output lines.
	 */
	public async listTypes(): Promise<string[]> {
		try {
			const cmd = `${this.jbang} ${this.defaultJbangArgs.join(' ')} init --list`;
			const output = execSync(cmd, { stdio: 'pipe' }).toString();
			const lines = output.split(/\r?\n/);
			const types = lines
				.map((l) => l.trim())
				.filter((l) => l.length > 0)
				// accept formats like "- junit", "* junit", or plain entries
				.map((l) => l.replace(/^[-*]\s+/, ''))
				.filter((l) => !/^available|templates|types|usage|\s*$/i.test(l));
			// remove duplicates, keep order
			return Array.from(new Set(types));
		} catch (e) {
			KaotoOutputChannel.logError('Unable to list Citrus test types via JBang CLI', e);
			return [];
		}
	}
}
