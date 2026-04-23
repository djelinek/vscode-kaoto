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
import { backendI18nDefaults, backendI18nDictionaries } from '@kie-tools-core/backend/dist/i18n';
import { VsCodeBackendProxy } from '@kie-tools-core/backend/dist/vscode';
import { EditorEnvelopeLocator, EnvelopeContentType, EnvelopeMapping } from '@kie-tools-core/editor/dist/api';
import { I18n } from '@kie-tools-core/i18n/dist/core';
import * as KogitoVsCode from '@kie-tools-core/vscode-extension/dist';
import { getRedHatService, TelemetryService } from '@redhat-developer/vscode-redhat-telemetry';
import * as vscode from 'vscode';
import { KAOTO_FILE_PATH_GLOB } from '../helpers/helpers';
import { VSCodeKaotoChannelApiProducer } from './../webview/VSCodeKaotoChannelApiProducer';
import { ExtensionContextHandler } from './ExtensionContextHandler';
import { KaotoOutputChannel } from './KaotoOutputChannel';
import { PortManager } from '../helpers/PortManager';

let backendProxy: VsCodeBackendProxy;
let telemetryService: TelemetryService;

export async function activate(context: vscode.ExtensionContext) {
	KaotoOutputChannel.logInfo('Starting extension activation...');
	KaotoOutputChannel.logInfo('Kaoto extension is alive.');

	KaotoOutputChannel.logInfo('Initializing backend i18n and proxy...');
	const backendI18n = new I18n(backendI18nDefaults, backendI18nDictionaries, vscode.env.language);
	backendProxy = new VsCodeBackendProxy(context, backendI18n);

	KaotoOutputChannel.logInfo('Starting KIE editor store...');
	const kieEditorStore = await KogitoVsCode.startExtension({
		extensionName: 'redhat.vscode-kaoto',
		context: context,
		viewType: 'webviewEditorsKaoto',
		editorEnvelopeLocator: new EditorEnvelopeLocator('vscode', [
			new EnvelopeMapping({
				type: 'kaoto',
				filePathGlob: KAOTO_FILE_PATH_GLOB,
				resourcesPathPrefix: 'dist/webview/editors/kaoto',
				envelopeContent: {
					type: EnvelopeContentType.PATH,
					path: 'dist/webview/KaotoEditorEnvelopeApp.js',
				},
			}),
		]),
		channelApiProducer: new VSCodeKaotoChannelApiProducer(),
		backendProxy: backendProxy,
	});
	KaotoOutputChannel.logInfo('KIE editor store initialized');

	KaotoOutputChannel.logInfo('Initializing port manager...');
	const portManager = new PortManager();

	/*
	 * init Red Hat Telemetry
	 */
	KaotoOutputChannel.logInfo('Initializing Red Hat Telemetry...');
	const redhatService = await getRedHatService(context);
	telemetryService = await redhatService.getTelemetryService();
	KaotoOutputChannel.logInfo('Telemetry service initialized');

	KaotoOutputChannel.logInfo('Creating extension context handler...');
	const contextHandler = new ExtensionContextHandler(context, kieEditorStore, telemetryService);

	/*
	 * register undo/redo blank commands
	 */
	KaotoOutputChannel.logInfo('Registering undo/redo commands...');
	contextHandler.registerUndoRedoCommands();

	/*
	 * register commands for a toggle source code (open/close camel file in a side textual editor)
	 */
	KaotoOutputChannel.logInfo('Registering toggle source code commands...');
	await contextHandler.registerToggleSourceCode();

	/*
	 * register open with Kaoto Editor
	 */
	KaotoOutputChannel.logInfo('Registering open with Kaoto command...');
	contextHandler.registerOpenWithKaoto();

	/*
	 * register all views (Integrations, Deployments, Tests, Help & Feedback, OpenAPI) first to avoid race conditions
	 */
	KaotoOutputChannel.logInfo('Registering views...');
	contextHandler.registerHelpAndFeedbackView();
	contextHandler.registerIntegrationsView();
	contextHandler.registerDeploymentsView(portManager);
	contextHandler.registerTestsView();
	contextHandler.registerOpenApiView();
	KaotoOutputChannel.logInfo('All views registered');

	/*
	 * register commands for 'Integrations' view
	 */
	KaotoOutputChannel.logInfo('Registering Integrations view commands...');
	await contextHandler.hideIntegrationsViewButtonsForMavenProjects();
	contextHandler.registerNewCamelFilesCommands();
	contextHandler.registerNewCamelProjectCommands();
	contextHandler.registerKubernetesRunCommands();
	contextHandler.registerRunIntegrationCommands(portManager);
	contextHandler.registerRunSourceDirCommands(portManager);
	KaotoOutputChannel.logInfo('Integrations view commands registered');

	/*
	 * register commands for 'Deployments' view
	 */
	KaotoOutputChannel.logInfo('Registering Deployments view commands...');
	contextHandler.registerDeploymentsIntegrationCommands(); // Stop and Logs view item action buttons
	contextHandler.registerDeploymentsRouteCommands(); // Stop/Start/Resume/Suspend route level buttons
	KaotoOutputChannel.logInfo('Deployments view commands registered');

	/*
	 * register commands for 'OpenAPI' view
	 */
	KaotoOutputChannel.logInfo('Registering OpenAPI view commands...');
	contextHandler.registerOpenApiImportCommand();
	KaotoOutputChannel.logInfo('OpenAPI view commands registered');

	/*
	 * register commands for 'Tests' view
	 */
	KaotoOutputChannel.logInfo('Registering Tests view commands...');
	contextHandler.registerTestsInitCommands();
	contextHandler.registerTestsRunCommands();
	KaotoOutputChannel.logInfo('Tests view commands registered');

	/*
	 * send extension startup event into Red Hat Telemetry
	 */
	KaotoOutputChannel.logInfo('Sending startup telemetry event...');
	await telemetryService.sendStartupEvent();

	/*
	 * show recommended extensions
	 */
	KaotoOutputChannel.logInfo('Showing recommended extensions...');
	await contextHandler.showRecommendedExtensions();

	/*
	 * Show What's New on first start for this version
	 */
	KaotoOutputChannel.logInfo("Checking What's New panel...");
	await contextHandler.showWhatsNewIfNeeded();

	/*
	 * check JBang is available on a system PATH
	 */
	const jbang = await contextHandler.checkJbangOnPath();

	/*
	 * check JBang Trusted Sources and plugins are configured
	 */
	if (jbang) {
		try {
			await contextHandler.checkJBangTrustedSources();
			await contextHandler.checkCamelJBangPlugins();
		} catch (error) {
			const errorMsg = `Failed to configure JBang trusted sources or plugins: ${error instanceof Error ? error.message : String(error)}`;
			KaotoOutputChannel.logError(errorMsg);
			console.error(`[Kaoto] ${errorMsg}`);
			vscode.window.showWarningMessage('Failed to configure JBang. Some features may not work properly.');
		}
	}

	KaotoOutputChannel.logInfo('Extension activation completed successfully');
	KaotoOutputChannel.logInfo('Kaoto extension is successfully setup.');
}

export async function deactivate() {
	KaotoOutputChannel.logInfo('Starting extension deactivation...');
	backendProxy?.stopServices();
	await telemetryService.sendShutdownEvent();
	KaotoOutputChannel.dispose();
}
