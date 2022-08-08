/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/mytimesheet/controls/OnBehalfButtonBase",
	"sap/uxap/ObjectPageHeaderActionButton",
	"sap/uxap/ObjectPageHeaderActionButtonRenderer"
], function(OnBehalfButtonBase, ObjectPageHeaderActionButton, ObjectPageHeaderActionButtonRenderer) {
	"use strict";

	var classDefinition = Object.create(OnBehalfButtonBase);
	classDefinition.renderer = ObjectPageHeaderActionButtonRenderer.render;
	classDefinition.init = function() {
		if (ObjectPageHeaderActionButton.prototype.init) {
			ObjectPageHeaderActionButton.prototype.init.apply(this, arguments);
		}
		
		this.initBase();

		this.setHideText(false);
		this.setHideIcon(false);
	};
	classDefinition.exit = function() {
		if (ObjectPageHeaderActionButton.prototype.exit) {
			ObjectPageHeaderActionButton.prototype.exit.apply(this, arguments);
		}
		this.exitBase();
	};
	return ObjectPageHeaderActionButton.extend("hcm.fab.mytimesheet.controls.OnBehalfObjectPageHeaderActionButton",
		classDefinition);
});