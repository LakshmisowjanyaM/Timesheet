/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
jQuery.sap.declare("hcm.fab.mytimesheet.view.blocks.blockCreateGroupHeader");
jQuery.sap.require("sap.uxap.BlockBase");
jQuery.sap.require("hcm.fab.mytimesheet.model.formatter");

sap.uxap.BlockBase.extend("hcm.fab.mytimesheet.view.blocks.blockCreateGroupHeader", {
	metadata: {
		views: {
			Collapsed: {
				viewName: "hcm.fab.mytimesheet.view.blocks.blockCreateGroupHeader",
				type: "XML"
			},
			Expanded: {
				viewName: "hcm.fab.mytimesheet.view.blocks.blockCreateGroupHeader",
				type: "XML"
			}
		},
		properties: {
			"columnLayout": {
				type: "sap.uxap.BlockBaseColumnLayout",
				group: "Behavior",
				defaultValue: "3"
			}
		}
	}
});