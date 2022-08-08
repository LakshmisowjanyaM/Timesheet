/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/mytimesheet/controls/ConcurrentEmploymentButtonBase",
	"sap/uxap/ObjectPageHeaderActionButton",
	"sap/uxap/ObjectPageHeaderActionButtonRenderer"
], function(ConcurrentEmploymentButtonBase, ObjectPageHeaderActionButton, ObjectPageHeaderActionButtonRenderer) {
	"use strict";

	var classDefinition = Object.create(ConcurrentEmploymentButtonBase);
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
	return ObjectPageHeaderActionButton.extend("hcm.fab.mytimesheet.controls.ConcurrentEmploymentObjectPageHeaderActionButton",
		classDefinition);
});