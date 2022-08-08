/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/mytimesheet/controls/ConcurrentEmploymentButtonBase",
	"sap/m/ButtonRenderer",
	"sap/m/OverflowToolbarButton"
], function(ConcurrentEmploymentButtonBase, ButtonRenderer, OverflowToolbarButton) {
	"use strict";

	var classDefinition = Object.create(ConcurrentEmploymentButtonBase);
	classDefinition.renderer = ButtonRenderer.render;
	classDefinition.init = function() {
		if (OverflowToolbarButton.prototype.init) {
			OverflowToolbarButton.prototype.init.apply(this, arguments);
		}
		this.initBase();
	};
	classDefinition.exit = function() {
		if (OverflowToolbarButton.prototype.exit) {
			OverflowToolbarButton.prototype.exit.apply(this, arguments);
		}
		this.exitBase();
	};
	return OverflowToolbarButton.extend("hcm.fab.mytimesheet.controls.ConcurrentEmploymentOverflowToolbarButton", classDefinition);
});