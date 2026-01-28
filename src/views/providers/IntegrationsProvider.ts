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
import { commands, TreeItem, TreeItemCollapsibleState, Uri, workspace } from 'vscode';
import { basename, join } from 'path';
import { parse } from 'yaml';
import { XMLParser } from 'fast-xml-parser';
import { KaotoOutputChannel } from '../../extension/KaotoOutputChannel';
import { Integration } from '../integrationTreeItems/Integration';
import { Route } from '../integrationTreeItems/Route';
import { Folder } from '../integrationTreeItems/Folder';
import { File } from '../integrationTreeItems/File';
import { KAOTO_INTEGRATIONS_FILES_REGEXP_SETTING_ID } from '../../helpers/helpers';
import { IntegrationFile, IntegrationFileIcon, IntegrationFileIconType, IntegrationFileDSL } from '../../types/IntegrationTreeItemType';
import { AbstractFolderTreeProvider } from './AbstractFolderTreeProvider';

export class IntegrationsProvider extends AbstractFolderTreeProvider<Folder> {
	public static readonly EXCLUDE_PATTERN =
		'{**/node_modules/**,**/.vscode/**,**/out/**,**/.camel-jbang*/**,**/target/**,**/.mvn/**,**/.citrus-jbang*/**,**/test/**,**/tests/**}';

	private filePattern: string;

	constructor(readonly extensionUriPath: string) {
		super();
		this.filePattern = this.buildFilePattern();
		this.initFileWatcher();

		// Recreate file watcher when configuration changes
		workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(KAOTO_INTEGRATIONS_FILES_REGEXP_SETTING_ID)) {
				this.filePattern = this.buildFilePattern();
				this.fileWatcher.dispose();

				this.fileWatcher = workspace.createFileSystemWatcher(this.filePattern);
				this.fileWatcher.onDidChange(this.refresh.bind(this));
				this.fileWatcher.onDidCreate(this.refresh.bind(this));
				this.fileWatcher.onDidDelete(this.refresh.bind(this));

				this.refresh();
			}
		});
	}

	/**
	 * Build the file pattern from configuration
	 * @returns The file pattern
	 */
	private buildFilePattern(): string {
		const filesRegexp: string[] = workspace.getConfiguration().get(KAOTO_INTEGRATIONS_FILES_REGEXP_SETTING_ID) as string[];
		return '{' + filesRegexp.map((r) => '**/' + r).join(',') + '}';
	}

	protected getFilePattern(): string {
		return this.filePattern;
	}

	protected getExcludePattern(): string {
		return IntegrationsProvider.EXCLUDE_PATTERN;
	}

	protected createFolderItem(name: string, folderUri: Uri, isUnderMavenRoot: boolean, isMavenRoot: boolean, isWorkspaceRoot: boolean = false): Folder {
		return new Folder(name, folderUri, undefined, isUnderMavenRoot, isMavenRoot, isWorkspaceRoot);
	}

	protected isFolderItem(element: TreeItem): element is Folder {
		return element instanceof Folder;
	}

	protected setContext(hasFiles: boolean): void {
		commands.executeCommand('setContext', 'kaoto.integrationExists', hasFiles);
	}

	/**
	 * Override getChildren to handle Integration route children
	 */
	async getChildren(element?: TreeItem): Promise<TreeItem[]> {
		// Handle Integration route children
		if (element instanceof Integration) {
			return await this.getRouteChildren(element);
		}
		// Use base class implementation for folders and root
		return super.getChildren(element);
	}

	/**
	 * Get the children for a route
	 * @param integration The integration to get the children for
	 * @returns The children
	 */
	private async getRouteChildren(integration: Integration): Promise<TreeItem[]> {
		if (integration.type !== 'route') {
			return [];
		}
		return (await this.getRoutesInsideIntegrationFile(integration.dsl, integration.filepath)) || [];
	}

	/**
	 * Convert a file to a tree item for the integrations view
	 * @param file The file to convert
	 * @param isUnderMavenRoot Whether the file is under a Maven root
	 * @param isTopLevelWithinWorkspace Whether the file is a top level within the workspace
	 * @returns The tree item
	 */
	protected async toTreeItemForFile(file: Uri, isUnderMavenRoot: boolean, isTopLevelWithinWorkspace: boolean): Promise<TreeItem> {
		const filename = basename(file.fsPath);
		// Treat Camel, Kamelet and Pipe files as Integration items; others as plain files
		if (
			filename.endsWith('.camel.yaml') ||
			filename.endsWith('.camel.xml') ||
			filename.endsWith('.kamelet.yaml') ||
			filename.endsWith('.pipe.yaml') ||
			filename.endsWith('-pipe.yaml')
		) {
			const { dsl, type, name, icon, description } = this.getFileType(filename);
			let collapsibleState = TreeItemCollapsibleState.None;
			// if the file is a route integration file, get the routes inside the file and set the collapsible state accordingly
			if (type === 'route') {
				const routes = await this.getRoutesInsideIntegrationFile(dsl, file);
				collapsibleState = routes.length > 0 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None;
			}
			return new Integration(name, filename, file, collapsibleState, type, dsl, icon, description, isUnderMavenRoot, isTopLevelWithinWorkspace);
		}
		return new File(file, filename);
	}

	/**
	 * Get the file type of an integration file
	 * @param fileName The name of the file
	 * @returns The file type
	 */
	private getFileType(fileName: string): IntegrationFile {
		if (fileName.endsWith('.kamelet.yaml')) {
			return { dsl: 'yaml', type: 'kamelet', name: basename(fileName, '.kamelet.yaml'), icon: this.getIcon('kamelet'), description: 'Kamelet' };
		}
		if (fileName.endsWith('-pipe.yaml')) {
			return { dsl: 'yaml', type: 'pipe', name: basename(fileName, '-pipe.yaml'), icon: this.getIcon('pipe'), description: 'Pipe' };
		}
		if (fileName.endsWith('.pipe.yaml')) {
			return { dsl: 'yaml', type: 'pipe', name: basename(fileName, '.pipe.yaml'), icon: this.getIcon('pipe'), description: 'Pipe' };
		}
		if (fileName.endsWith('.camel.xml')) {
			return { dsl: 'xml', type: 'route', name: basename(fileName, '.camel.xml'), icon: this.getIcon('route'), description: 'Camel Route' };
		}
		// every unknown integration file is considered as Route integration file
		return { dsl: 'yaml', type: 'route', name: basename(fileName, '.camel.yaml'), icon: this.getIcon('route'), description: 'Camel Route' };
	}

	/**
	 * Get the icon for an integration type
	 * @param type The type of the integration
	 * @returns The icon
	 */
	private getIcon(type: IntegrationFileIconType): IntegrationFileIcon {
		const basePath = join(this.extensionUriPath, 'icons', 'integrations');
		switch (type) {
			case 'kamelet':
				return { light: Uri.file(join(basePath, 'kamelets-file-icon-light.png')), dark: Uri.file(join(basePath, 'kamelets-file-icon-dark.png')) };
			case 'pipe':
				return { light: Uri.file(join(basePath, 'pipes-file-icon-light.png')), dark: Uri.file(join(basePath, 'pipes-file-icon-dark.png')) };
			case 'route':
				return { light: Uri.file(join(basePath, 'routes-file-icon-light.png')), dark: Uri.file(join(basePath, 'routes-file-icon-dark.png')) };
			case 'route-child':
				return { light: Uri.file(join(basePath, 'route-black.svg')), dark: Uri.file(join(basePath, 'route-white.svg')) };
			// every unknown is considered as Route integration file
			default:
				return { light: Uri.file(join(basePath, 'routes-file-icon-light.png')), dark: Uri.file(join(basePath, 'routes-file-icon-dark.png')) };
		}
	}

	/**
	 * Get the routes inside an integration file
	 * @param dsl The DSL of the integration file
	 * @param filePath The Uri path to the integration file
	 * @returns The routes
	 */
	private async getRoutesInsideIntegrationFile(dsl: IntegrationFileDSL, filePath: Uri): Promise<Route[]> {
		// parse the integration file based on the DSL
		switch (dsl) {
			case 'yaml':
				return await this.parseYamlFile(filePath);
			case 'xml':
				return await this.parseXmlFile(filePath);
			default:
				return [];
		}
	}

	/**
	 * Parse a YAML integration file and return the routes
	 * @param filePath The Uri path to the YAML file
	 * @returns The routes
	 */
	private async parseYamlFile(filePath: Uri): Promise<Route[]> {
		try {
			const fileBuffer = await workspace.fs.readFile(filePath);
			const content = new TextDecoder('utf-8').decode(fileBuffer);
			const parsedYaml = parse(content);

			// skip empty YAML files
			if (!parsedYaml || typeof parsedYaml !== 'object') {
				return [];
			}

			return Object.values(parsedYaml)
				.filter((item: any) => item.route)
				.map((item: any) => new Route(item.route.id, item.route.description, this.getIcon('route-child')));
		} catch (error) {
			KaotoOutputChannel.logError(`Error parsing YAML file: ${filePath.fsPath}`, error);
			return [];
		}
	}

	/**
	 * Parse a XML integration file and return the routes
	 * @param filePath The Uri path to the XML file
	 * @returns The routes
	 */
	private async parseXmlFile(filePath: Uri): Promise<Route[]> {
		try {
			const fileBuffer = await workspace.fs.readFile(filePath);
			if (!fileBuffer || fileBuffer.length === 0) {
				// skip empty XML file
				return [];
			}

			const fileContent = fileBuffer.toString().trim(); // remove unnecessary whitespaces

			const parser = new XMLParser({
				ignoreAttributes: false,
				attributeNamePrefix: '',
				parseAttributeValue: true,
				trimValues: true,
				isArray: (name) => name === 'route', // force route to always be an array
			});

			const parsedXml = parser.parse(fileContent);
			if (!parsedXml || typeof parsedXml !== 'object') {
				KaotoOutputChannel.logWarning(`Invalid XML structure: ${filePath.fsPath}`);
				return [];
			}

			// normalize route structure (handling JBang init vs Kaoto XML)
			let routes: any[] = [];
			if (parsedXml.routes?.route) {
				routes = Array.isArray(parsedXml.routes.route) ? parsedXml.routes.route : [parsedXml.routes.route];
			} else if (parsedXml.camel?.route) {
				routes = Array.isArray(parsedXml.camel.route) ? parsedXml.camel.route : [parsedXml.camel.route];
			} else {
				KaotoOutputChannel.logWarning(`No <route> elements found in XML: ${filePath.fsPath}`);
				return [];
			}

			return routes.map((route) => new Route(route.id, route.description, this.getIcon('route-child')));
		} catch (error) {
			KaotoOutputChannel.logError(`Error parsing XML file: ${filePath.fsPath}`, error);
			return [];
		}
	}
}
