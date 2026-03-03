/**
 * Minimal mock of the `obsidian` module for use in Jest tests.
 * Only the symbols actually imported by the plugin source are mocked here.
 */

export class Plugin {
	app: any;
	addRibbonIcon(_icon: string, _title: string, _cb: () => void) {}
	addCommand(_cmd: any) {}
	addSettingTab(_tab: any) {}
	async loadData(): Promise<any> { return {}; }
	async saveData(_data: any): Promise<void> {}
}

export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl: any = {
		empty() {},
		createEl(_tag: string, _opts?: any) { return { innerHTML: "" }; },
	};
	constructor(app: any, plugin: any) {
		this.app = app;
		this.plugin = plugin;
	}
}

export class Setting {
	constructor(_container: any) {}
	setName(_name: string) { return this; }
	setDesc(_desc: string) { return this; }
	addText(cb: (t: any) => any) {
		cb({ setPlaceholder() { return this; }, setValue() { return this; }, onChange() { return this; } });
		return this;
	}
	addTextArea(cb: (t: any) => any) {
		cb({ setPlaceholder() { return this; }, setValue() { return this; }, onChange() { return this; } });
		return this;
	}
	addToggle(cb: (t: any) => any) {
		cb({ setValue() { return this; }, onChange() { return this; } });
		return this;
	}
}

export class Notice {
	constructor(_msg: string, _timeout?: number) {}
	hide() {}
}

export class TFile {
	basename = "";
	path = "";
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}
