/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/m/Button",
	"sap/m/VBox",
	"sap/m/HBox",
	"sap/m/FlexBox",
	"sap/m/Image",
	"sap/m/Text",
	"sap/m/Label",
	"sap/m/List",
	"sap/m/Link",
	"sap/m/StandardListItem",
	"sap/m/ObjectStatus",
	"sap/m/Toolbar",
	"sap/ui/layout/Splitter",
	"sap/ui/core/Icon",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/layout/VerticalLayout",
	"sap/ui/layout/HorizontalLayout",
	"sap/ui/core/Fragment",
	"hcm/fab/lib/common/util/CommonModelManager"
], function (
	Control,
	JSONModel,
	ODataModel,
	Button,
	VBox,
	HBox,
	FlexBox,
	Image,
	Text,
	Label,
	List,
	Link,
	StandardListItem,
	ObjectStatus,
	Toolbar,
	Splitter,
	Icon,
	Filter,
	FilterOperator,
	VerticalLayout,
	HorizontalLayout,
	Fragment,
	CommonModelManager
) {
	"use strict";

	var _oAvatar = null;
	var _oGridList = null;
	var _oGridListItem = null;
	var _oGridBoxLayout = null;
	var _oCustomNode = null;
	var _oCustomLayout = null;

	var OrgChartControl = Control.extend("hcm.fab.lib.common.controls.OrgChartControl", {
		metadata: {
			library: "hcm.fab.lib.common",
			properties: {
				applicationId: {
					type: "string"
				},
				rootObjectId: {
					type: "string"
				},
				rootObjectType: {
					type: "string"
				},
				expandUpEnabled: {
					type: "boolean",
					defaultValue: true
				},
				expandDownEnabled: {
					type: "boolean",
					defaultValue: true
				},
				nodeGroupingLimit: {
					type: "int",
					defaultValue: 8
				},
				height: {
					type: "sap.ui.core.CSSSize",
					defaultValue: "100%"
				},
				width: {
					type: "sap.ui.core.CSSSize",
					defaultValue: "100%"
				}
			},
			aggregations: {
				_graph: {
					type: "sap.ui.core.Control",
					multiple: false,
					visibility: "hidden"
				}
			},
			events: {
				nodeSelect: {
					parameters: {
						selectedObjectType: {
							type: "string"
						},
						selectedObjectId: {
							type: "string"
						},
						sourceNode: {
							type: "sap.ui.core.Control"
						}
					}
				},
				rootChange: {
					parameters: {
						newRootObjectType: {
							type: "string"
						},
						newRootObjectId: {
							type: "string"
						},
						oldRootObjectType: {
							type: "string"
						},
						oldRootObjectId: {
							type: "string"
						}
					}
				},
				nodeDetails: {
					parameters: {
						selectedObjectType: {
							type: "string"
						},
						selectedObjectId: {
							type: "string"
						},
						sourceNode: {
							type: "sap.ui.core.Control"
						}
					}
				}
			}
		},

		oGraphModel: new JSONModel({
			nodes: [],
			lines: []
		}),
		oCurrentGraphData: null,
		iSingleObjectWidth: 0,
		iSingleObjectHeight: 0,
		iSmallSingleObjectWidth: 0,
		iSmallSingleObjectHeight: 0,
		iSmallObjectButtonWidth: 0,
		iSmallObjectPictureWidth: 0,
		iTinyMargin: 0,
		iButtonHeight: 0,
		aStoredChildNodes: [],
		nextNodeId: 0,
		sFullScreen: true,
		oCurrentSelectedNode: null,
		oCurrentRootNode: null,
		bGraphInitialized: false,
		bShowNodePicture: true,

		_oGraph: null,
		_oVBoxLinks: null,
		_oContentContainer: null,
		_oQueuedInitRequest: undefined,
		_oResourceBundle: null,

		oOdataModel: new ODataModel("/sap/opu/odata/sap/HCMFAB_COMMON_SRV/", {
			disableHeadRequestForToken: true,
			useBatch: true
		}),

		init: function () {
			// node dimensions
			this.iSingleObjectWidth = 160;
			this.iSmallSingleObjectWidth = 290;
			// this.iSingleObjectHeight = 0; calculated later
			// this.iSmallSingleObjectHeight = 0; calculated later
			this.iSmallObjectButtonWidth = 56;
			this.iSmallObjectPictureWidth = 56;

			var oUI5Version = sap.ui.getCore().getConfiguration().getVersion();
			this._oResourceBundle = CommonModelManager.getI18NModel().getResourceBundle();
			if (oUI5Version.compareTo(1, 70) >= 0) {
				sap.ui.require([
						"sap/f/Avatar",
						"sap/f/GridList",
						"sap/f/GridListItem",
						"sap/ui/layout/cssgrid/GridBoxLayout",
						"sap/suite/ui/commons/networkgraph/Graph",
						"sap/suite/ui/commons/networkgraph/layout/LayeredLayout",
						"sap/suite/ui/commons/networkgraph/layout/LayoutAlgorithm",
						"sap/suite/ui/commons/networkgraph/layout/LayoutTask",
						"sap/suite/ui/commons/networkgraph/Node",
						"sap/suite/ui/commons/networkgraph/NodeRenderer",
						"sap/suite/ui/commons/networkgraph/Line"
					],
					function (Avatar, GridList, GridListItem, GridBoxLayout, Graph, LayeredLayout, LayoutAlgorithm, LayoutTask, Node, NodeRenderer,
						Line) {
						if (!_oAvatar) {
							_oAvatar = Avatar;
						}
						if (!_oGridList) {
							_oGridList = GridList;
						}
						if (!_oGridListItem) {
							_oGridListItem = GridListItem;
						}
						if (!_oGridBoxLayout) {
							_oGridBoxLayout = GridBoxLayout;
						}
						if (!_oCustomNode) {
							_oCustomNode = this._defineNetworkGraphCustomNode(Node, NodeRenderer);
						}
						if (!_oCustomLayout) {
							_oCustomLayout = this._defineCustomLayout(LayoutAlgorithm, LayoutTask);
						}

						CommonModelManager.getDefaultAssignment(this.getApplicationId()).then(function (defaultAssignment) {
							this.bShowNodePicture = defaultAssignment.ShowEmployeePicture;
							this._oGraph = new Graph({
								enableWheelZoom: false,
								orientation: "TopBottom",
								width: "100%",
								height: "100%",
								id: "graph",
								layoutAlgorithm: new _oCustomLayout(),
								nodes: {
									path: "Graph>/nodes",
									templateShareable: false,
									template: new _oCustomNode({
										key: "{Graph>id}",
										collapsed: "{Graph>collapsed}",
										description: "{Graph>name}",
										showActionLinksButton: false,
										showExpandButton: false,
										showDetailButton: false,
										descriptionLineSize: 0,
										shape: "Box",
										coreNodeSize: 500
									})
								},
								lines: {
									path: "Graph>/lines",
									template: new Line({
										from: "{Graph>from}",
										to: "{Graph>to}",
										stretchToCenter: true,
										arrowOrientation: "None",
										press: this.onLinePress.bind(this)
									})
								}
							});

							this._oContentContainer = new VBox({
								height: "100%",
								width: "100%",
								renderType: "Bare"
							});
							this._oVBoxLinks = new VBox({
								renderType: "Bare",
								width: (this.iSingleObjectWidth - 20).toString() + "px",
								id: "vBoxLinks"
							});

							var oDelegate = {
								onAfterRendering: function () {
									if (this._oVBoxLinks.getItems().length > 0) {
										this._calculateMaxNameHeight(this.oCurrentGraphData, this.oCurrentRootNode);
										// recalculate size of all box nodes
										this.oCurrentGraphData.nodes.forEach(function (oNode) {
											if (oNode.isBoxNode) {
												this._resizeNode(oNode);
											}
										}.bind(this));
										this._calculateTinyMargin();
										this._calculateButtonHeight();
										this._oVBoxLinks.destroyItems();
										this._oGraph.destroyAllElements();
										this.oGraphModel.setData(this.oCurrentGraphData);
										this._oContentContainer.addItem(this._oGraph);
									}
								}.bind(this)
							};
							this._oVBoxLinks.addEventDelegate(oDelegate);

							this._oContentContainer.addItem(this._oVBoxLinks);
							this.setAggregation("_graph", this._oContentContainer);

							this._initGraph();
							this._queueInitRequest();
						}.bind(this));
					}.bind(this)
				);
			} else {
				//orgChart not available -> display info message
				this._oGraph = new Text({
					text: this._oResourceBundle.getText("orgChartNotAvailable")
				});
				this.setAggregation("_graph", this._oGraph);
			}

		},

		renderer: function (oRM, oControl) {
			oRM.write("<div");
			oRM.addStyle("width", oControl.getWidth());
			oRM.addStyle("height", oControl.getHeight());
			oRM.writeControlData(oControl);
			oRM.writeClasses();
			oRM.writeStyles();
			oRM.write(">");

			if (oControl.getAggregation("_graph")) {
				oRM.renderControl(oControl.getAggregation("_graph"));
			}
			oRM.write("</div>");
		},

		setRootObjectId: function (sRootObjectId) {
			// read initial subtree - first load
			this.setProperty("rootObjectId", sRootObjectId);
			this._queueInitRequest();
		},

		setRootObjectType: function (sRootObjectType) {
			this.setProperty("rootObjectType", sRootObjectType);
			this._queueInitRequest();
		},

		setApplicationId: function (sApplicationId) {
			this.setProperty("applicationId", sApplicationId);
			this._queueInitRequest();
		},

		createId: function (sId) {
			return this.getId() + "-" + sId;
		},

		_defineNetworkGraphCustomNode: function (oBaseNode, oNodeRenderer) {
			var oNetworkGraphCustomNode = oBaseNode.extend("hcm.fab.lib.common.controls.orgChartControl.NetworkGraphCustomNode", {
				renderer: oNodeRenderer.render
			});
			oNetworkGraphCustomNode.prototype._mouseDown = function (i) {
				return this;
			};
			return oNetworkGraphCustomNode;
		},

		_defineCustomLayout: function (oLayoutAlgorithm, oLayoutTask) {
			return oLayoutAlgorithm.extend("hcm.fab.lib.common.controls.orgChartControl.CustomLayout", {
				cHorizontalSpacing: 10,
				cVerticalSpacing: 60,
				aLevelWidth: [],
				aObjects: [],

				getLayoutRenderType: function () {
					return sap.suite.ui.commons.networkgraph.LayoutRenderType.LayeredWithGroups;
				},
				layout: function () {
					return new oLayoutTask(function (fnResolve, fnReject, _oLayoutTask) {
						// The task might have been canceled by a newer update call. Do not update graph as it might collide
						// with another layout task.
						if (_oLayoutTask.isTerminated()) {
							fnResolve();
							return;
						}

						var oGraph = this.getParent();
						var aNodes = oGraph.getNodes();
						this.aObjects = aNodes[0].getBindingInfo("key").binding.getModel().getData().nodes;

						this.aLevelWidth = [];
						this.aObjects.forEach(function (oObject) {
							if (oObject.isTop || oObject.parentObjectId === "00000000") {
								// for all root nodes do the following things:
								this._calculateRenderingWidthForSubtree(oObject);
								this._calculateXPositionsForSubtree(oObject, 0); //root level = 0
								this._calculateYPositionsForSubtree(oObject);
							}
						}, this);

						this.aObjects.forEach(function (oObject) {
							var oNode = this._getNode(aNodes, oObject.id);
							oNode.setX(oObject.x);
							oNode.setY(oObject.y);
						}, this);

						// adjust the lines
						var aLines = oGraph.getLines();
						// !IMPORTANT
						// don't use direct aggregation methods in this function (like addCoordinate) as it would
						// trigger invalidate to the graph and throw code in the never ending loop (as line is not rendered yet
						// and invalidate throws invalidation to its parent).
						// these methods does not trigger invalidate.

						aLines.forEach(function (oLine) {
							var oSourceNode, oTargetNode;

							oSourceNode = this._getNode(aNodes, oLine.getFrom());
							oTargetNode = this._getNode(aNodes, oLine.getTo());

							var oSourceObject = this._getObject(oSourceNode.getKey());
							var oTargetObject = this._getObject(oTargetNode.getKey());

							var iSourceNodeCenterX = oSourceNode.getX() + oSourceObject.width / 2;
							var iSourceNodeCenterY = oSourceNode.getY() + oSourceObject.height / 2;

							var iTargetNodeCenterX = oTargetNode.getX() + oTargetObject.width / 2;
							var iTargetNodeCenterY = oTargetNode.getY() + oTargetObject.height / 2;

							oLine.setSource({
								x: iSourceNodeCenterX,
								y: iSourceNodeCenterY
							});

							oLine.setTarget({
								x: iTargetNodeCenterX,
								y: iTargetNodeCenterY
							});

							// !IMPORTANT
							// before adding bends you have to add target and source
							oLine.clearBends();
							oLine.addBend({
								x: iSourceNodeCenterX,
								y: iSourceNodeCenterY + (oSourceObject.height / 2) + (this.cVerticalSpacing / 2)
							});

							oLine.addBend({
								x: iTargetNodeCenterX,
								y: iTargetNodeCenterY - (oTargetObject.height / 2) - (this.cVerticalSpacing / 2)
							});

						}.bind(this));

						fnResolve();
					}.bind(this));
				},

				//*****************************************************************************************************
				// local functions
				//*****************************************************************************************************

				//-----------------------------
				// calculate width of a subtree
				//-----------------------------
				_calculateRenderingWidthForSubtree: function (oObject) {
					oObject.renderingWidth = this._calculateRenderingWidth(oObject);
					oObject.childNodes.forEach(function (oChildNode) {
						if (oObject.id.substring(0, 1) !== "D") {
							this._calculateRenderingWidthForSubtree(oChildNode);
						}
					}.bind(this));
				},

				//--------------------------
				// calculate width of a node
				//--------------------------
				_calculateRenderingWidth: function (oObject) {
					if (oObject.expanded) {
						// no children
						if (oObject.childNodes.length === 0) {
							return 0;
						}

						// calculate width of all children
						var width = 0;
						oObject.childNodes.forEach(function (oChildNode) {
							width = width + this._calculateRenderingWidth(oChildNode) + this.cHorizontalSpacing;
						}.bind(this));
						return width - this.cHorizontalSpacing;
					} else {
						// take own width
						return oObject.width;
					}
				},

				//------------------------------------
				// calculate the X-positions of a node
				//------------------------------------
				_calculateXPositionsForSubtree: function (oObject, level) {
					// first time calculation for this level
					if (!(level in this.aLevelWidth)) {
						this.aLevelWidth[level] = 0;
					}

					if (level === 0) {
						oObject.x = (oObject.renderingWidth / 2) - (oObject.width / 2) + this.aLevelWidth[level];
						this.aLevelWidth[level] = this.aLevelWidth[level] + oObject.renderingWidth + this.cHorizontalSpacing;
					} else {
						var oParent = this._getObject(oObject.parentId);
						if (this.aLevelWidth[level] < (oParent.x - (oParent.renderingWidth / 2) + (oParent.width / 2))) {
							this.aLevelWidth[level] = oParent.x - (oParent.renderingWidth / 2) + (oParent.width / 2);
						}
						oObject.x = (oObject.renderingWidth / 2) - (oObject.width / 2) + this.aLevelWidth[level];
						this.aLevelWidth[level] = this.aLevelWidth[level] + oObject.renderingWidth + this.cHorizontalSpacing;
					}
					if (!oObject.isBoxNode && oObject.expanded) {
						oObject.childNodes.forEach(function (oChildNode) {
							this._calculateXPositionsForSubtree(oChildNode, level + 1);

						}.bind(this));
					}
				},

				//-----------------------------------
				// calculate the Y-position of a node
				//-----------------------------------
				_calculateYPositionsForSubtree: function (oObject) {
					if (!oObject.isTop || oObject.parentObjectId === "00000000") {
						if (oObject.parentObjectId === "00000000") {
							oObject.y = 0 + this.cVerticalSpacing; //no parent -> most upper root node
						} else {
							// new root node -> but with parent
							var oParent = this._getObject(oObject.parentId);
							oObject.y = oParent.y + oParent.height + this.cVerticalSpacing;
						}
					} else {
						oObject.y = 0; // no parent -> start on top
					}

					if (!oObject.isBoxNode && oObject.expanded) {
						oObject.childNodes.forEach(function (oChildNode) {
							this._calculateYPositionsForSubtree(oChildNode);
						}.bind(this));
					}
				},

				//------------------------------------------
				// get the graph node for an internal object
				//------------------------------------------
				_getNode: function (aNodes, sKey) {
					for (var i = 0; i < aNodes.length; i++) {
						if (aNodes[i].getKey() === sKey) {
							return aNodes[i];
						}
					}
					return null;
				},

				//-----------------------------------------
				// get the internal object for a graph node
				//-----------------------------------------
				_getObject: function (sKey) {
					for (var i = 0; i < this.aObjects.length; i++) {
						if (this.aObjects[i].id === sKey) {
							return this.aObjects[i];
						}
					}
					return null;
				}

			});
		},

		//------------------------------------------
		// create new node (for internal JSON model)
		//------------------------------------------
		_createNodeObject: function (oDefaultValues) {
			return jQuery.extend({
				id: undefined,
				objectId: undefined,
				objectType: undefined,
				name: undefined,
				parentId: undefined,
				parentObjectId: undefined,
				parentObjectType: undefined,
				collapsed: false,
				expanded: false,
				wasInBox: false,
				isBoxNode: false,
				isTop: false,
				childNodes: [],
				numChildren: 0,
				numChildrenForButton: 0,
				hasSiblingKids: false,
				picture: undefined,
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				renderingWidth: 0,
				maxNameHeight: 0
			}, oDefaultValues);
		},

		_initGraph: function () {
			this._oGraph.setBusyIndicatorDelay(0);
			this._oGraph.setModel(this.oGraphModel, "Graph");

			this.setModel(CommonModelManager.getI18NModel(), "libI18N");

			// adjust toolbar-> remove legend button and seearch field
			var oToolbar = this._oGraph.getToolbar();
			var aToolbarContent = oToolbar.getContent();
			// remove the search field
			for (var i = 0; i < aToolbarContent.length; i++) {
				if (aToolbarContent[i].getMetadata().getElementName() === "sap.m.SearchField") {
					oToolbar.removeContent(i);
					break;
				}
			}
			// remove the legend button
			aToolbarContent = oToolbar.getContent();
			for (i = 0; i < aToolbarContent.length; i++) {
				if (aToolbarContent[i].getMetadata().getElementName() === "sap.m.OverflowToolbarButton" || aToolbarContent[i].getMetadata().getElementName() ===
					"sap.m.ToggleButton") {
					if (aToolbarContent[i].getIcon() === "sap-icon://legend") {
						oToolbar.removeContent(i);
						break;
					}
				}
			}

			//register beforeLayouting event (is used to create the custom node content)
			this._oGraph.attachEvent("beforeLayouting", function (oEvent) {
				// nodes are not rendered yet (!bOutput) so their invalidation triggers parent (graph) invalidation
				// which results in multiple unnecessary loading
				this._oGraph.preventInvalidation(true);

				this._oGraph.getNodes().forEach(function (oNode) {

					var oObject = this._getObject(this.oCurrentGraphData.nodes, oNode.getKey());
					if (oNode.getKey().substring(0, 1) === "D") {
						this._setBoxNodeContent(oNode, oObject);
					} else {
						this._setSingleNodeContent(oNode, oObject);
					}
				}, this);
				this._oGraph.preventInvalidation(false);

			}.bind(this));

			// select and focus the node which was clicked
			// -> in case of level up use the node of next level manager
			// -> in case of moving the EE back in box, select the Box
			this._oGraph.attachEvent("graphReady", function (oEvent) {
				this._oGraph.getNodes().forEach(function (oNode, index) {
					if (this.oCurrentSelectedNode.id === oNode.getKey()) {
						oNode.setSelected(true);
						this._oGraph.scrollToElement(oNode);
					}
				}, this);
				this._oGraph.setBusy(false);
			}.bind(this));
		},

		_queueInitRequest: function () {
			if (this._queuedInitRequest) {
				jQuery.sap.clearDelayedCall(this._queuedInitRequest);
			}
			this._queuedInitRequest = jQuery.sap.delayedCall(0, this, "_initializeGraphData");
		},

		_initializeGraphData: function () {
			// check if all required properties are filled
			if (!this.getProperty("applicationId") || !this.getProperty("rootObjectId") || !this.getProperty("rootObjectType")) {
				return;
			}
			var oRootNode = this._createNodeObject({
				objectId: this.getProperty("rootObjectId"),
				objectType: this.getProperty("rootObjectType")
			});
			this._addSubtree(oRootNode, "INIT");
		},

		exit: function () {
			if (this._queuedInitRequest) {
				jQuery.sap.clearDelayedCall(this._queuedInitRequest);
			}
		},

		//**************************************************************************************************************************************
		// Event Handler
		//**************************************************************************************************************************************

		//-------------------------
		// Expand node out of a box
		//-------------------------
		onExpandBoxNode: function (oEvent) {
			var sPath = oEvent.getSource().getBindingContext("Graph").getPath();
			var oSelNode = this.oGraphModel.getProperty(sPath);
			this._oGraph.setBusy(true);
			this.oCurrentSelectedNode = oSelNode;
			this._addSubtree(oSelNode, "BOXOUT");
		},

		//----------------------------
		// Expand/Collapse single node
		//----------------------------
		onToggleSingleNode: function (oEvent) {

			var sPath = oEvent.getSource().getBindingContext("Graph").getPath();
			var oSelNode = this.oGraphModel.getProperty(sPath);
			this._oGraph.setBusy(true);
			this.oCurrentSelectedNode = oSelNode;

			// expand or collapse
			if (!oSelNode.expanded) {
				// node gets expanded
				this._addSubtree(oSelNode, "DOWN");
			} else {
				// node gets collapsed
				oSelNode.expanded = false;
				oSelNode.collapsed = true;
				oSelNode.numChildrenForButton = oSelNode.numChildren;
				// store and remove childNodes
				this._storeAndRemoveChildNodes(this.oCurrentGraphData, oSelNode);

				if (oSelNode.wasInBox) {
					// put node back in box
					var parentId = "D" + oSelNode.parentId;
					var oBoxNode = this._getObject(this.oCurrentGraphData.nodes, parentId);
					if (oBoxNode === null) {
						for (var k = 0; k < this.oCurrentGraphData.nodes.length; k++) {
							if (this.oCurrentGraphData.nodes[k].parentId === oSelNode.parentId && this.oCurrentGraphData.nodes[k].id.substring(0, 1) ===
								"D") {
								oBoxNode = this._getObject(this.oCurrentGraphData.nodes, this.oCurrentGraphData.nodes[k].id);
								break;
							}
						}
					}

					if (oBoxNode === null) {
						// check if node has a collapse sibling -> put node and sibling in new box
						var oParentNode = this._getObject(this.oCurrentGraphData.nodes, oSelNode.parentId);
						var oSiblingNode = null;
						for (var i = 0; i < oParentNode.childNodes.length; i++) {
							if (oParentNode.childNodes[i].expanded === false && oParentNode.childNodes[i].id !== oSelNode.id) {
								oSiblingNode = oParentNode.childNodes[i];
								break;
							}
						}
						if (oSiblingNode !== null) {
							oBoxNode = this._createNodeObject({
								id: "D" + this._createNodeId(), //ID is D with the ID of the manager
								parentId: oSelNode.parentId,
								objectId: oSelNode.parentObjectId,
								objectType: oSelNode.parentObjectType,
								parentObjectId: oSelNode.parentObjectId,
								parentObjectType: oSelNode.parentObjectType,
								isBoxNode: true
							});
							// put selected node and sibling in box
							oBoxNode.childNodes.push(oSelNode);
							oBoxNode.childNodes.push(oSiblingNode);
							oBoxNode = this._resizeNode(oBoxNode);
							this.oCurrentGraphData.nodes.push(oBoxNode);
							this.oCurrentGraphData.lines.push({
								from: oBoxNode.parentId,
								to: oBoxNode.id
							});
							// remove nodes from parents childNode list
							oParentNode = this._getObject(this.oCurrentGraphData.nodes, oSelNode.parentId);
							// add box to parents child nodes
							// insert new single Node direct beside the Box Node; so the new Node apprears directly right from the Box node
							var iInsertIndex = oParentNode.childNodes.indexOf(oSelNode);
							iInsertIndex = iInsertIndex + 1;
							oParentNode.childNodes.splice(iInsertIndex, 0, oBoxNode);
							oParentNode.childNodes = this._removeNode(oParentNode.childNodes, oSelNode.id);
							oParentNode.childNodes = this._removeNode(oParentNode.childNodes, oSiblingNode.id);

							for (var l = 0; l < oParentNode.childNodes.length; l++) {
								if (oParentNode.childNodes[l].id.substring(0, 1) === "D") {
									this.oCurrentSelectedNode = oParentNode.childNodes[l];
									break;
								}
							}
							// remove nodes from graph
							this.oCurrentGraphData.nodes = this._removeNode(this.oCurrentGraphData.nodes, oSelNode.id);
							this.oCurrentGraphData.lines = this._removeLine(this.oCurrentGraphData.lines, oSelNode.id);
							this.oCurrentGraphData.nodes = this._removeNode(this.oCurrentGraphData.nodes, oSiblingNode.id);
							this.oCurrentGraphData.lines = this._removeLine(this.oCurrentGraphData.lines, oSiblingNode.id);
						}
					} else {
						// put node back in existing box
						oBoxNode.childNodes.push(oSelNode);
						oBoxNode = this._resizeNode(oBoxNode);

						// remove node from parents childNode list
						oParentNode = this._getObject(this.oCurrentGraphData.nodes, oSelNode.parentId);
						oParentNode.childNodes = this._removeNode(oParentNode.childNodes, oSelNode.id);

						for (l = 0; l < oParentNode.childNodes.length; l++) {
							if (oParentNode.childNodes[l].id.substring(0, 1) === "D") {
								this.oCurrentSelectedNode = oParentNode.childNodes[l];
								break;
							}
						}

						// remove node from graph
						this.oCurrentGraphData.nodes = this._removeNode(this.oCurrentGraphData.nodes, oSelNode.id);
						this.oCurrentGraphData.lines = this._removeLine(this.oCurrentGraphData.lines, oSelNode.id);
					}
				} else {
					// big node was closed -> check child nodes of sibling and reslove box node if needed
					this._convertSiblingBoxNode(oSelNode);

				}

				//this.oGraphModel.setData(this.oCurrentGraphData);
				this._createNameLinks();
			}
		},

		//--------------------------------
		// Expand root node (one level up)
		//--------------------------------
		onExpandRootNode: function (oEvent) {
			var oSelNode = oEvent.getSource().getBindingContext("Graph").getObject();
			this._oGraph.setBusy(true);
			this._addSubtree(oSelNode, "UP");
		},

		//--------------
		// Press Node
		//--------------
		onAvatarPressed: function (oEvent) {
			var oAvatar = oEvent.getSource();
			var oSelNode = oAvatar.getBindingContext("Graph").getObject();
			this.fireNodeDetails({
				selectedObjectType: oSelNode.objectType,
				selectedObjectId: oSelNode.objectId,
				sourceNode: oAvatar
			});
		},

		//-----------------------------
		// Node selected (link pressed)
		//-----------------------------
		onNodeSelected: function (oEvent) {
			var sPath = oEvent.getSource().getBindingContext("Graph").getPath();
			var oSelNode = this.oGraphModel.getProperty(sPath);
			this.fireNodeSelect({
				selectedObjectType: oSelNode.objectType,
				selectedObjectId: oSelNode.objectId,
				sourceNode: oEvent.getSource()
			});
		},

		//--------------
		// MenuButton
		//--------------
		onMenuAction: function (oEvent) {
			// Prevents a popup with tooltip when clicking on a line
		},

		//--------------
		// Line Selected
		//--------------
		onLinePress: function (oEvent) {
			// Prevents a popup with tooltip when clicking on a line
			oEvent.preventDefault();
		},

		//************************************************************************************************************************************
		// local functions
		//************************************************************************************************************************************

		//--------------------------------------------
		// add subtree
		// sMode: INIT (initialize tree), UP (one level up from old root), DOWN (one level down from given node), BOXOUT (one level down + move out of box)
		//--------------------------------------------
		_addSubtree: function (oSelectedObject, sMode) {
			var oSubRootObject = null;
			var sRootObjectId = null;
			var sRootObjectType = null;
			var sApplicationId = this.getProperty("applicationId");

			var aFilters = [];

			if (!this._oGraph) {
				return;
			}
			// get objectId of subtree root object
			if (sMode === "UP") {
				sRootObjectId = oSelectedObject.parentObjectId;
				sRootObjectType = oSelectedObject.parentObjectType;
			} else {
				sRootObjectId = oSelectedObject.objectId;
				sRootObjectType = oSelectedObject.objectType;
			}

			// check if data was already stored
			if (sMode !== "UP" && sMode !== "INIT" && this.aStoredChildNodes[oSelectedObject.id]) {
				oSubRootObject = oSelectedObject;
				this._mergeSubtree(this.aStoredChildNodes[oSelectedObject.id], oSubRootObject, oSelectedObject, sMode);
				return;
			}

			// read data from backend
			// filter for root node
			aFilters.push(new Filter("ApplicationId", sap.ui.model.FilterOperator.EQ, sApplicationId));
			aFilters.push(new Filter({
				filters: [
					new Filter({
						filters: [
							new Filter("ObjectId", sap.ui.model.FilterOperator.EQ, sRootObjectId),
							new Filter("ObjectType", sap.ui.model.FilterOperator.EQ, sRootObjectType)
						],
						and: true
					}),
					new Filter({
						filters: [
							new Filter("ParentObjectId", sap.ui.model.FilterOperator.EQ, sRootObjectId),
							new Filter("ParentObjectType", sap.ui.model.FilterOperator.EQ, sRootObjectType)
						],
						and: true
					})
				],
				and: false
			}));

			this.oOdataModel.read("/OrgchartObjectSet", {
				filters: aFilters,
				urlParameters: {
					"$expand": "ToOrgchartPicture"
				},
				success: function (oData) {

					var bAllInOneBox = false;
					var oBoxObject = null;
					var oSubtreeData = {
						nodes: [],
						lines: []
					};
					var bHasSiblingsKids = oData.results.some(function (currentValue, index) {
						return index > 0 && currentValue.NumChildren > 0;
					});

					oData.results.forEach(function (oObject, index) {

						if (index === 0) {
							// first object coming from backend is the root of the subtree
							if (sMode === "DOWN" || sMode === "BOXOUT") {
								// the selected object is the root object of the subtree (adjust some properties)
								oSubRootObject = oSelectedObject;
								oSubRootObject.numChildren = oObject.NumChildren;
								oSubRootObject.numChildrenForButton = oObject.NumChildren;
							} else {
								// no root object was given -> create a new root object from the first object
								oSubRootObject = this._createNodeObject({
									id: this._createNodeId(),
									objectId: oObject.ObjectId,
									objectType: oObject.ObjectType,
									name: oObject.Name,
									parentId: "",
									parentObjectId: oObject.ParentObjectId,
									parentObjectType: oObject.ParentObjectType,
									isTop: (oObject.ParentObjectId !== "00000000"),
									expanded: true,
									width: this.iSingleObjectWidth,
									height: this.iSingleObjectHeight,
									numChildren: oObject.NumChildren,
									numChildrenForButton: oObject.NumChildren,
									picture: oObject.ToOrgchartPicture.__metadata.media_src.replace(/(\w+\:\/\/)?[^\/]+/, "")
								});
								oSubtreeData.nodes.push(oSubRootObject);
							}

							if (oObject.NumChildren > this.getNodeGroupingLimit() || oSubRootObject.bKeepBoxStyle || sMode === "BOXOUT") {
								bAllInOneBox = true;
								var iEEToSubstract = 1; //-> manager is within the result, need to substract the boss
								if (sMode === "UP" && oSelectedObject.expanded) {
									iEEToSubstract = 2; //-> level up, that means that one employee already exists a single node -> substract 2 (employee + boss)
								}
								var iNumberfOfItems = oData.results.length - iEEToSubstract;
								var iColumns = iNumberfOfItems / 8;
								iColumns = Math.ceil(iColumns);
								var iColumnPadding = 20;
								if (iColumns === 1) {
									iColumnPadding = 16;
								}

								// create one dummy box node for all the children
								oBoxObject = this._createNodeObject({
									id: "D" + oSubRootObject.id, //ID is D with the ID of the manager
									parentId: oSubRootObject.id,
									objectId: oObject.ObjectId,
									objectType: oObject.ObjectType,
									parentObjectId: oObject.ObjectId, //ParentId,
									parentObjectType: oObject.ObjectType,
									isBoxNode: true,
									width: (iColumns * this.iSmallSingleObjectWidth) + (iColumns * iColumnPadding),
									height: this._calculateNodeHeight(iColumns, iNumberfOfItems)
								});
								oSubtreeData.nodes.push(oBoxObject);
								oSubRootObject.childNodes.push(oBoxObject);
								// add a line from root to box node
								oSubtreeData.lines.push({
									from: oSubRootObject.id,
									to: oBoxObject.id
								});
							}
						} else {
							// add the child objects
							var oNewChildObject = this._createNodeObject({
								id: this._createNodeId(),
								objectId: oObject.ObjectId,
								objectType: oObject.ObjectType,
								name: oObject.Name,
								parentId: oSubRootObject.id,
								parentObjectId: oSubRootObject.objectId,
								parentObjectType: oSubRootObject.objectType,
								collapsed: (oObject.NumChildren > 0),
								hasSiblingKids: bHasSiblingsKids,
								width: this.iSingleObjectWidth,
								height: this.iSingleObjectHeight,
								numChildren: oObject.NumChildren,
								numChildrenForButton: oObject.NumChildren,
								picture: oObject.ToOrgchartPicture.__metadata.media_src.replace(/(\w+\:\/\/)?[^\/]+/, "")
							});
							if (bAllInOneBox) {
								// add all the children into the box
								oNewChildObject.wasInBox = true;
								oBoxObject.childNodes.push(oNewChildObject);
							} else {
								// add a single node per object
								oSubtreeData.nodes.push(oNewChildObject);
								oSubRootObject.childNodes.push(oNewChildObject);
								// add a line from child to root node
								oSubtreeData.lines.push({
									from: oSubRootObject.id,
									to: oNewChildObject.id
								});
							}
						}
					}.bind(this));
					this._mergeSubtree(oSubtreeData, oSubRootObject, oSelectedObject, sMode);
				}.bind(this),
				error: function (oError) {}
			});
		},

		//-------------------------------------
		// _mergeSubtree: insert new subtree into graph
		//-------------------------------------
		_mergeSubtree: function (oSubtree, oSubRootObject, oSelectedObject, sMode) {
			switch (sMode) {
			case "INIT":
				// initialize the graph (new subtree is the complete graph)					
				this.oCurrentGraphData = oSubtree;
				if (oSubtree.nodes.length > 0) {
					this.oCurrentSelectedNode = oSubtree.nodes[0];
					this.oCurrentRootNode = oSubtree.nodes[0];
				}
				break;
			case "UP":
				// insert existing root node below the new subtree node
				this._processUP(this.oCurrentGraphData, oSubRootObject, oSelectedObject, oSubtree);
				this.oCurrentRootNode = oSubRootObject;
				break;
			case "DOWN":
				// add new subtree below selected node
				this._processDOWN(this.oCurrentGraphData, oSubRootObject, oSubtree);
				break;
			case "BOXOUT":
				// remove selected mode from box and add a new node/boxnode to insert the new subtree
				this._processBOXOUT(this.oCurrentGraphData, oSubRootObject, oSubtree);
				break;
			}
			this._createNameLinks();
		},

		//-----------------------------------------
		// expand node out of a box 
		//-----------------------------------------
		_processBOXOUT: function (oGraphData, oRootObject, oNewSubtreeData) {

			oRootObject.numChildrenForButton = oRootObject.numChildren;
			this.oCurrentSelectedNode = oRootObject;

			// remove node from box
			var parentId = "D" + oRootObject.parentId;
			var oBoxNode = this._getObject(oGraphData.nodes, parentId);
			if (oBoxNode === null) {
				for (var i = 0; i < oGraphData.nodes.length; i++) {
					if (oGraphData.nodes[i].parentId === oRootObject.parentId && oGraphData.nodes[i].id.substring(0, 1) === "D") {
						oBoxNode = this._getObject(oGraphData.nodes, oGraphData.nodes[i].id);
						break;
					}
				}
			}

			if (oBoxNode.childNodes.length === 2) {
				// remove the last 2 children and delete the box
				oBoxNode.childNodes.forEach(function (oChildNode) {
					// add single node to graph
					if (oChildNode.id === oRootObject.id) {
						oChildNode.collapsed = false;
						oChildNode.expanded = true;
					} else {
						oChildNode.collapsed = true;
						oChildNode.expanded = false;
					}
					oChildNode.keepBoxStyle = true; //render the box a small box

					oGraphData.nodes.push(oChildNode);
					oGraphData.lines.push({
						from: oChildNode.parentId,
						to: oChildNode.id
					});

					// add node to childNode list of parent
					var oParentNode = this._getObject(oGraphData.nodes, oChildNode.parentId);

					// insert new single Node direct beside the Box Node; so the new Node apprears directly right from the Box node
					var iInsertIndex = oParentNode.childNodes.indexOf(oBoxNode);
					iInsertIndex = iInsertIndex + 1;
					oParentNode.childNodes.splice(iInsertIndex, 0, oChildNode);
				}.bind(this));
				// remove box node from parent node children
				var oParentBoxNode = this._getObject(oGraphData.nodes, oBoxNode.parentId);
				oParentBoxNode.childNodes = this._removeNode(oParentBoxNode.childNodes, oBoxNode.id);
				// delete box node
				this._removeNodeAndLines(oGraphData, oBoxNode);

			} else {
				// remove node out of box (more than 1 node remain in box)
				oBoxNode.childNodes = this._removeNode(oBoxNode.childNodes, oRootObject.id);
				oBoxNode = this._resizeNode(oBoxNode);

				// add single node to graph
				oRootObject.collapsed = false;
				oRootObject.expanded = true;
				oRootObject.keepBoxStyle = true; //render the box a small box

				oGraphData.nodes.push(oRootObject);
				oGraphData.lines.push({
					from: oRootObject.parentId,
					to: oRootObject.id
				});

				// add node to childNode list of parent
				var oParentNode = this._getObject(oGraphData.nodes, oRootObject.parentId);

				// insert new single Node direct beside the Box Node; so the new Node apprears directly right from the Box node
				var iInsertIndex = oParentNode.childNodes.indexOf(oBoxNode);
				iInsertIndex = iInsertIndex + 1;
				oParentNode.childNodes.splice(iInsertIndex, 0, oRootObject);
			}

			// add subtree data to new single node
			oGraphData.nodes = oGraphData.nodes.concat(oNewSubtreeData.nodes);
			oGraphData.lines = oGraphData.lines.concat(oNewSubtreeData.lines);

		},

		//-----------------------------------------------------------
		// expand single node one level down 
		//-----------------------------------------------------------
		_processDOWN: function (oGraphData, oRootObject, oNewSubtreeData) {
			// selected node gets expanded and subtree is added

			// check if selected EE has siblings with kids that are already expanded
			var bExpandedSiblingExists = false;
			if (!oRootObject.isTop) {
				for (var i = 0; i < oGraphData.nodes.length; i++) {
					if (oRootObject.parentId === oGraphData.nodes[i].parentId && oGraphData.nodes[i].numChildren > 0 && oGraphData.nodes[i].expanded) {
						bExpandedSiblingExists = true;
						break;
					}
				}
			}
			// add subtree data for the expanded node
			oRootObject.collapsed = false;
			oRootObject.expanded = true;
			oGraphData.nodes = oGraphData.nodes.concat(oNewSubtreeData.nodes);
			oGraphData.lines = oGraphData.lines.concat(oNewSubtreeData.lines);

			//need to convert everthing under the parent ID to Box Style
			if (bExpandedSiblingExists) {
				// check if children are already in a Box
				var bMoveKidsInBox = !oRootObject.childNodes.some(function (currentValue) {
					return currentValue.id.substring(0, 1) === "D" || currentValue.wasInBox;
				});

				if (bMoveKidsInBox) {
					this._moveChildrenInBox(oGraphData, oRootObject);
				}

				//now convert the other expanded Nodes
				for (var j = 0; j < oGraphData.nodes.length; j++) {
					if (oGraphData.nodes[j].parentId === oRootObject.parentId &&
						oGraphData.nodes[j].id !== oRootObject.id &&
						oGraphData.nodes[j].expanded &&
						oGraphData.nodes[j].id.substring(0, 1) !== "D" && // node is already a box
						oGraphData.nodes[j].childNodes[0].id.substring(0, 1) !== "D") { // child is already a Box
						this._moveChildrenInBox(oGraphData, oGraphData.nodes[j]);
					}
				}
			} else {
				if (oRootObject.childNodes[0].id.substring(0, 1) === "D" && oRootObject.NumChildren <= this.getNodeGroupingLimit()) {
					this._convertSelectedBoxNode(oRootObject);
				}
			}
			this.oCurrentSelectedNode = oRootObject;
		},

		//----------------------------------------------------------------
		// expand tree one level up from existing old root
		//----------------------------------------------------------------
		_processUP: function (oGraphData, oNewRootObject, oOldRootObject, oNewSubtreeData) {
			this.oCurrentSelectedNode = oNewRootObject;

			// old root node is no longer root
			oOldRootObject.isTop = false;
			oOldRootObject.height = this.iSingleObjectHeight;
			oOldRootObject.parentId = oNewRootObject.id;

			oOldRootObject.hasSiblingKids = oNewRootObject.childNodes.some(function (currentValue, index) {
				return index > 0 && currentValue.numChildren > 0;
			});

			// remove the old rootNode from the new subtree
			if (oNewRootObject.numChildren > this.getNodeGroupingLimit()) {
				// delete old root from box node
				var boxNodeId = "D" + oNewRootObject.id;
				var oBoxNode = this._getObject(oNewSubtreeData.nodes, boxNodeId);
				oBoxNode.childNodes = oBoxNode.childNodes.filter(function (oChildObject) {
					return oChildObject.objectId !== oOldRootObject.objectId;
				});
				if (oOldRootObject.expanded === false) {
					// move old old root object in new box
					oBoxNode.childNodes.push(oOldRootObject);
					// remove old root node from graph
					oGraphData.nodes = this._removeNode(oGraphData.nodes, oOldRootObject.id);
				} else {
					// add old root node to child nodes of the new node
					oNewRootObject.childNodes.push(oOldRootObject);
					// add a line from the new rootnode to the existing old root node
					oNewSubtreeData.lines.push({
						from: oOldRootObject.parentId,
						to: oOldRootObject.id
					});
				}
				oOldRootObject.wasInBox = true; //need to set this to make sure that this manager is inserted in the box
				oOldRootObject.keepBoxStyle = true; //render the box as small box

				// need to move the children of sel node into one Box node (recursive)
				// check if subtree of the child is already in BoxStyle
				var bResizeNeeded = !oOldRootObject.childNodes.some(function (currentValue) {
					return currentValue.id.substring(0, 1) === "D" || currentValue.wasInBox;
				});
				if (bResizeNeeded) {
					this._moveChildrenInBox(oGraphData, oOldRootObject);
				}

			} else {
				// delete line to old root in new subtree
				oNewSubtreeData.nodes.forEach(function (oNewNode) {
					if (oNewNode.objectId === oOldRootObject.objectId) {
						oNewSubtreeData.lines = this._removeLine(oNewSubtreeData.lines, oNewNode.id);
					}
				}.bind(this));

				// delete old root from new nodes
				oNewSubtreeData.nodes = oNewSubtreeData.nodes.filter(function (oChildObject) {
					return oChildObject.objectId !== oOldRootObject.objectId;
				});

				// delete object with old root obhectId from new root child nodes
				oNewRootObject.childNodes = oNewRootObject.childNodes.filter(function (oChildObject) {
					return oChildObject.objectId !== oOldRootObject.objectId;
				});
				oOldRootObject.keepBoxStyle = false;
				// add old root node to child nodes of the new node
				oNewRootObject.childNodes.push(oOldRootObject);
				// add a line from the new rootnode to the existing old root node
				oNewSubtreeData.lines.push({
					from: oOldRootObject.parentId,
					to: oOldRootObject.id
				});
			}
			oGraphData.nodes = oGraphData.nodes.concat(oNewSubtreeData.nodes);
			oGraphData.lines = oGraphData.lines.concat(oNewSubtreeData.lines);

			// send root change event
			this.fireRootChange({
				newRootObjectType: oNewRootObject.objectType,
				newRootObjectId: oNewRootObject.objectId,
				oldRootObjectType: oOldRootObject.objectType,
				oldRootObjectId: oOldRootObject.objectId
			});
		},

		//---------------------------------------------------------------------------
		// _convertSiblingBoxNode: check and convert sibling box node to single nodes
		//---------------------------------------------------------------------------
		_convertSiblingBoxNode: function (oSelNode) {
			if (oSelNode.parentId && oSelNode.childNodes[0].id.substring(0, 1) === "D") {
				var oParentNode = this._getObject(this.oCurrentGraphData.nodes, oSelNode.parentId);
				var numOpenSiblings = 0;
				var oLastSibling;
				oParentNode.childNodes.forEach(function (oSibling) {
					if (oSibling.id !== oSelNode.id && oSibling.expanded) {
						numOpenSiblings = numOpenSiblings + 1;
						oLastSibling = oSibling;
					}
				});

				var numNodes = 0;
				if (oLastSibling) {
					numNodes = oLastSibling.childNodes.length;

					if (oLastSibling.childNodes[0].id.substring(0, 1) === "D") {
						numNodes = numNodes + oLastSibling.childNodes[0].childNodes.length - 1;
					}
				}
				if (numOpenSiblings === 1 && numNodes <= this.getNodeGroupingLimit()) {
					// convert box to single nodes
					this._convertSelectedBoxNode(oLastSibling);
				}
			}
		},

		//---------------------------------------------------------------
		// _convertSelectedBoxNode: create single nodes for nodes in box
		//---------------------------------------------------------------
		_convertSelectedBoxNode: function (oSelNode) {
			var aNewChildNodes = [];
			oSelNode.childNodes.forEach(function (oChildNode, index) {
				if (index === 0 && oChildNode.id.substring(0, 1) === "D") {
					oChildNode.childNodes.forEach(function (oNewSingleNode) {
						oNewSingleNode.wasInBox = false;
						this.oCurrentGraphData.nodes.push(oNewSingleNode);
						this.oCurrentGraphData.lines.push({
							from: oSelNode.id,
							to: oNewSingleNode.id
						});
						aNewChildNodes.push(oNewSingleNode);
					}.bind(this));

					this.oCurrentGraphData.nodes = this._removeNode(this.oCurrentGraphData.nodes, oChildNode.id);
					this.oCurrentGraphData.lines = this._removeLine(this.oCurrentGraphData.lines, oChildNode.id);
				} else {
					oChildNode.wasInBox = false;
					oChildNode.keepBoxStyle = false;
					aNewChildNodes.push(oChildNode);

					var oParentNode = this._getObject(this.oCurrentGraphData.nodes, oChildNode.parentId);
					var numOpenSiblings = 0;
					oParentNode.childNodes.forEach(function (oSibling) {
						if (oSibling.id !== oChildNode.id && oSibling.expanded) {
							numOpenSiblings = numOpenSiblings + 1;
						}
					});
					if (numOpenSiblings === 0) {
						this._convertSelectedBoxNode(oChildNode);
					}
				}

			}.bind(this));
			oSelNode.childNodes = aNewChildNodes;
		},

		//----------------------------------------------------------------------------
		// store and remove the nodes and lines of a subtree (when a node is collapsed)
		//----------------------------------------------------------------------------
		_storeAndRemoveChildNodes: function (oGraphData, oNode) {
			var aStoredNodes = [];
			var aStoredLines = [];
			this._storeAndRemoveRecursiveChildNodes(oGraphData, aStoredNodes, aStoredLines, oNode);
			this.aStoredChildNodes[oNode.id] = {
				nodes: aStoredNodes,
				lines: aStoredLines
			};
		},

		//-------------------------------------------------------
		// recursive function to store and remove nodes and lines
		//-------------------------------------------------------
		_storeAndRemoveRecursiveChildNodes: function (oGraphData, aStoredNodes, aStoredLines, oNode) {
			oNode.childNodes.forEach(function (oChildNode) {
				aStoredNodes.push(oChildNode);
				var aLinesToStore = oGraphData.lines.filter(function (oLine) {
					return oLine.to === oChildNode.id;
				});
				aLinesToStore.forEach(function (oLine) {
					aStoredLines.push(oLine);
				});
				this._removeNodeAndLines(oGraphData, oChildNode);
				if (oChildNode.expanded) {
					this._storeAndRemoveRecursiveChildNodes(oGraphData, aStoredNodes, aStoredLines, oChildNode);
				}
			}.bind(this));
		},

		//--------------------------------------
		// remove nodes and lines of a subtree
		//--------------------------------------
		_removeNodeAndLines: function (oGraphData, oRemovedNode) {
			oGraphData.nodes = oGraphData.nodes.filter(function (oNode) {
				return oNode.id !== oRemovedNode.id;
			});
			oGraphData.lines = oGraphData.lines.filter(function (oLine) {
				return oLine.to !== oRemovedNode.id;
			});
		},

		//-----------------------------------------------
		// create content of a SINGLE node (one employee)
		//-----------------------------------------------
		_setSingleNodeContent: function (oNode, oObject) {

			if (oObject.keepBoxStyle) {
				//----------------
				// SMALL single node
				//----------------

				//give oObject new height and width
				oObject.height = this.iSmallSingleObjectHeight;
				oObject.width = this.iSmallSingleObjectWidth;
				oNode.setContent(
					this._createSmallNodeContent(oObject)
				);
				oNode.setWidth(oObject.width);
				oNode.setHeight(oObject.height);
				oNode.keepBoxStyle = true;
			} else {

				//----------------
				// BIG single node
				//----------------
				oObject.width = this.iSingleObjectWidth;
				var iExpandButtonHeight = this.iButtonHeight + (2 * this.iTinyMargin);
				var iExpandUpIconHeight = 20;
				var iPictureSize = 100;
				var iLinkHeight = oObject.maxNameHeight;
				var lheight = iPictureSize + iLinkHeight + iExpandButtonHeight + (2 * this.iTinyMargin);

				// node has no children and no siblings with children -> no space for button down needed
				if (!oObject.hasSiblingKids && oObject.numChildren === 0) {
					lheight = lheight - iExpandButtonHeight;
					iExpandButtonHeight = 0;
				}
				//make upper node bigger to provide more space for arrow-up-icon
				if (oObject.isTop && this.getExpandUpEnabled()) {
					lheight = lheight + iExpandUpIconHeight;
				}

				oObject.height = lheight;
				oNode.destroyContent();
				oNode.setContent(

					new VBox({
						renderType: "Bare",
						alignItems: "Center",
						alignContent: "Start",
						height: lheight.toString() + "px",
						width: oObject.width + "px",
						backgroundDesign: sap.m.BackgroundDesign.Solid,
						items: [
							new ObjectStatus({
								press: this.onExpandRootNode.bind(this),
								icon: "sap-icon://slim-arrow-up",
								active: true,
								visible: this.getExpandUpEnabled() ? "{Graph>isTop}" : false
							}),

							new VBox({
								renderType: "Bare",
								alignItems: "Center",
								width: "100%",
								height: (this.getExpandUpEnabled() && oObject.isTop) ? (lheight - (iExpandUpIconHeight + iExpandButtonHeight)).toString() +
									"px" : (lheight - iExpandButtonHeight).toString() + "px",
								backgroundDesign: sap.m.BackgroundDesign.Solid,
								items: [
									new _oAvatar({
										src: this.bShowNodePicture ? "{Graph>picture}" : "",
										displayShape: sap.f.AvatarShape.Circle,
										displaySize: sap.f.AvatarSize.Custom,
										customDisplaySize: iPictureSize.toString() + "px",
										tooltip: "{Graph>name}",
										press: this.onAvatarPressed.bind(this)
									}).addStyleClass("sapUiTinyMarginTop"),
									new Text({
										text: "{Graph>name}",
										textAlign: "Center",
										wrapping: true,
										tooltip: "{Graph>name}",
										width: (this.iSingleObjectWidth - 20).toString() + "px",
										visible: !this.hasListeners("nodeSelect")
									}).addStyleClass("sapUiTinyMarginTop"),
									new Link({
										id: "NameLink" + oObject.id,
										text: "{Graph>name}",
										textAlign: "Center",
										wrapping: true,
										width: (this.iSingleObjectWidth - 20).toString() + "px",
										tooltip: "{Graph>name}",
										press: this.onNodeSelected.bind(this),
										visible: this.hasListeners("nodeSelect")
									}).addStyleClass("sapUiTinyMarginTop")
								]
							}),

							new VBox({
								renderType: "Bare",
								alignItems: "Center",
								justifyContent: "End",
								width: "100%",
								height: iExpandButtonHeight.toString() + "px",
								visible: "{=${Graph>numChildren}>0}",
								backgroundDesign: sap.m.BackgroundDesign.Transparent,
								items: this.getExpandDownEnabled() ? [
									new Button({
										press: this.onToggleSingleNode.bind(this),
										text: "{Graph>numChildrenForButton}",
										tooltip: "{=${Graph>expanded} ? ${libI18N>collapse} : ${libI18N>expand}}",
										visible: "{=${Graph>numChildren}>0}"
									}).addStyleClass("sapUiTinyMarginBottom")
								] : [
									new Text({
										text: "{Graph>numChildrenForButton}",
										visible: "{=${Graph>numChildren}>0}"
									}).addStyleClass("sapUiTinyMarginBottom")
								]
							})
						]
					})

				);

				oNode.setWidth(oObject.width);
				oNode.setHeight(lheight);
			}
		},

		//---------------------------------------
		// create GridListItems 
		//---------------------------------------
		_gridListFactory: function (sId, oContext) {

			//var oNode = this.oGraphModel.getProperty(oContext.getPath());
			var oObject = this.oGraphModel.getProperty(oContext.getPath());
			return new _oGridListItem({
				content: this._createSmallNodeContent(oObject)
			}).addStyleClass("sapUiTinyMarginBegin").addStyleClass("sapUiTinyMarginEnd");
		},

		//---------------------------------------
		// create content for small node
		//---------------------------------------
		_createSmallNodeContent: function (oObject) {

			var lheight = this.iSmallSingleObjectHeight;
			return new HBox({
				renderType: "Bare",
				alignContent: "Center",
				alignItems: "Center",
				justifyContent: "Start",
				backgroundDesign: sap.m.BackgroundDesign.Solid,
				width: this.iSmallSingleObjectWidth + "px",
				height: lheight + "px",
				items: [
					new HBox({
						renderType: "Bare",
						alignContent: "Center",
						alignItems: "Center",
						width: (this.iSmallSingleObjectWidth - this.iSmallObjectButtonWidth).toString() + "px",
						height: "100%",
						backgroundDesign: sap.m.BackgroundDesign.Solid,
						items: [
							new _oAvatar({
								src: this.bShowNodePicture ? "{Graph>picture}" : "",
								displayShape: sap.f.AvatarShape.Circle,
								displaySize: sap.f.AvatarSize.Custom,
								customDisplaySize: this.iSmallObjectPictureWidth.toString() + "px",
								tooltip: "{Graph>name}",
								press: this.onAvatarPressed.bind(this)
							}).addStyleClass("sapUiTinyMarginBegin"),
							new Text({
								text: "{Graph>name}",
								textAlign: "Center",
								wrapping: true,
								width: (this.iSmallSingleObjectWidth - this.iSmallObjectButtonWidth - this.iSmallObjectPictureWidth - (1 * this.iTinyMargin))
									.toString() + "px",
								maxLines: 3,
								visible: !this.hasListeners("nodeSelect")
							}).addStyleClass("sapUiTinyMarginBegin"),
							new Link({
								text: "{Graph>name}",
								tooltip: "{Graph>name}",
								textAlign: "Center",
								wrapping: oObject.maxNameHeight < 4,
								width: (this.iSmallSingleObjectWidth - this.iSmallObjectButtonWidth - this.iSmallObjectPictureWidth - (1 * this.iTinyMargin))
									.toString() + "px",
								press: this.onNodeSelected.bind(this),
								visible: this.hasListeners("nodeSelect")
							}).addStyleClass("sapUiTinyMarginBegin")

						]
					}),

					new HBox({
						renderType: "Bare",
						alignContent: "End",
						justifyContent: "End",
						alignItems: "Center",
						height: "100%",
						width: this.iSmallObjectButtonWidth.toString() + "px",
						items: this.getExpandDownEnabled() ? [
							new Button({
								press: oObject.expanded ? this.onToggleSingleNode.bind(this) : this.onExpandBoxNode.bind(this),
								text: "{Graph>numChildrenForButton}",
								tooltip: "{=${Graph>expanded} ? ${libI18N>collapse} : ${libI18N>expand}}",
								visible: "{=${Graph>numChildren}>0}"
							}).addStyleClass("sapUiTinyMarginEnd")
						] : [
							new Text({
								text: "{Graph>numChildrenForButton}",
								visible: "{=${Graph>numChildren}>0}"
							}).addStyleClass("sapUiTinyMarginEnd")
						]
					})
				]
			});
		},

		//------------------
		// _createNameLinks
		//------------------
		_createNameLinks: function () {
			var oVBoxBigNodeNames = new VBox({
				width: (this.iSingleObjectWidth - 20).toString() + "px"
			});
			this._oVBoxLinks.addItem(oVBoxBigNodeNames);
			var oVBoxSmallNodeNames = new VBox({
				width: (this.iSmallSingleObjectWidth - this.iSmallObjectButtonWidth - this.iSmallObjectPictureWidth - (1 * this.iTinyMargin)).toString() +
					"px"
			});
			this._oVBoxLinks.addItem(oVBoxSmallNodeNames);

			this.oCurrentGraphData.nodes.forEach(function (oNode, index) {
				if (index === 0) {
					// add box with margin and without margin to determine tinyMargin in pixels
					var oMarginBox = new VBox({
						id: "vBoxMargin"
					});
					oMarginBox.addItem(new Link({
						id: "LM" + oNode.id,
						text: oNode.name,
						wrapping: true
					}).addStyleClass("sapUiTinyMarginTop"));
					oVBoxBigNodeNames.addItem(oMarginBox);

					var oNoMarginBox = new VBox({
						id: "vBoxNoMargin"
					});
					oNoMarginBox.addItem(new Link({
						id: "LNM" + oNode.id,
						text: oNode.name,
						wrapping: true
					}));
					oVBoxBigNodeNames.addItem(oNoMarginBox);
					// add a button to mease the rendered button height
					oVBoxBigNodeNames.addItem(new Button({
						id: "btnMeasure",
						text: "0"
					}));
				}

				// render names to determine the height for name display in big node and small node width
				if (!oNode.isBoxNode) {
					if (this.hasListeners("nodeSelect")) {
						oVBoxBigNodeNames.addItem(new Link({
							id: "LB" + oNode.id,
							text: oNode.name,
							wrapping: true
						}));
					} else {
						oVBoxBigNodeNames.addItem(new Text({
							id: "LB" + oNode.id,
							text: oNode.name,
							wrapping: true
						}));
					}
					oVBoxSmallNodeNames.addItem(new Link({
						id: "L" + oNode.id,
						text: oNode.name,
						wrapping: true
					}));
					oVBoxSmallNodeNames.addItem(new Link({
						id: "L1" + oNode.id,
						text: oNode.name,
						wrapping: false
					}));
				} else {
					oNode.childNodes.forEach(function (oChildNode) {
						oVBoxSmallNodeNames.addItem(new Link({
							id: "L" + oChildNode.id,
							text: oChildNode.name,
							wrapping: true
						}));
						oVBoxSmallNodeNames.addItem(new Link({
							id: "L1" + oChildNode.id,
							text: oChildNode.name,
							wrapping: false
						}));
					});
				}
			}.bind(this));
		},

		//--------------------------------------
		// calculate tinyMargin height in pixels
		//--------------------------------------
		_calculateTinyMargin: function () {
			this.iTinyMargin = $("#vBoxMargin").height() - $("#vBoxNoMargin").height();
		},

		//--------------------------------------
		// calculate buttonHeightheight in pixels
		//--------------------------------------
		_calculateButtonHeight: function () {
			this.iButtonHeight = $("#btnMeasure").height();
		},

		//------------------------------------------------
		// calculate max. name height for the single nodes
		//------------------------------------------------
		_calculateMaxNameHeight: function (oGraphData, oRootNode) {
			var lineHeight = 0;
			if (oRootNode.isBoxNode) { //box node
				oRootNode.childNodes.forEach(function (oChildNode) {
					lineHeight = (3 * $("#L1" + oChildNode.id).height()) + 10;
					if (this.iSmallSingleObjectHeight < lineHeight) {
						this.iSmallSingleObjectHeight = lineHeight;
					}
					oChildNode.maxNameHeight = Math.ceil($("#L" + oChildNode.id).height() / $("#L1" + oChildNode.id).height());
				}.bind(this));
				return;
			} else if (oRootNode.wasInBox) { //small single node
				lineHeight = (3 * $("#L1" + oRootNode.id).height()) + 10;
				if (this.iSmallSingleObjectHeight < lineHeight) {
					this.iSmallSingleObjectHeight = lineHeight;
				}
				oRootNode.maxNameHeight = Math.ceil($("#L" + oRootNode.id).height() / $("#L1" + oRootNode.id).height());
				oRootNode.childNodes.forEach(function (oChildNode) {
					this._calculateMaxNameHeight(oGraphData, oChildNode);
				}.bind(this));
			} else { //big node
				// calculate maximum of own name lenght, parent node children 
				var maxHeight = $("#LB" + oRootNode.id).height();
				var oParentNode = this._getObject(oGraphData.nodes, oRootNode.parentId);
				if (oParentNode) {
					oParentNode.childNodes.forEach(function (oChildNode) {
						if (!oChildNode.isBoxNode && $("#LB" + oChildNode.id).height() > maxHeight) {
							maxHeight = $("#LB" + oChildNode.id).height();
						}
					});
				}
				oRootNode.maxNameHeight = maxHeight;

				// do the same for all child nodes of the given root
				oRootNode.childNodes.forEach(function (oChildNode) {
					this._calculateMaxNameHeight(oGraphData, oChildNode);
				}.bind(this));
			}
		},

		//-----------------------------------------------------
		// create the content of a BOX Node
		//-----------------------------------------------------
		_setBoxNodeContent: function (oNode, oObject) {

			oNode.setContent(
				new VBox({
					height: oObject.height + "px",
					width: oObject.width + "px",
					backgroundDesign: sap.m.BackgroundDesign.Solid,
					items: [
						new _oGridList({
							customLayout: new _oGridBoxLayout({
								boxMinWidth: this.iSmallSingleObjectWidth.toString() + "px"
							}),
							items: {
								path: "Graph>childNodes",
								factory: this._gridListFactory.bind(this),
								templateShareable: false
							}
						}).addStyleClass("sapUiTinyMarginTop")
					]
				}));

			//set width to get multi column
			oNode.setWidth(oObject.width);
			oNode.setHeight(oObject.height);
		},

		//--------------------------
		// get object for given key
		//--------------------------
		_getObject: function (aObjects, sId) {
			for (var i = 0; i < aObjects.length; i++) {
				if (aObjects[i].id === sId) {
					return aObjects[i];
				}
			}
			return null;
		},

		//--------------------------
		// get object by objectID and parentId
		//--------------------------
		_getObjectByObjectId: function (aObjects, sId, sParentId) {
			for (var i = 0; i < aObjects.length; i++) {
				if (aObjects[i].id === sId && aObjects[i].parentId === sParentId) {
					return aObjects[i];
				}
			}
			return null;
		},

		//---------------------------------------
		// remove object with given Id from array
		//---------------------------------------
		_removeNode: function (aNodes, sId) {
			return aNodes.filter(function (oNode) {
				return oNode.id !== sId;
			});
		},

		//-------------------------------------
		// remove lines with given targetNodeId
		//-------------------------------------
		_removeLine: function (aLines, sTargetNodeId) {
			return aLines.filter(function (oLine) {
				return oLine.to !== sTargetNodeId;
			});
		},

		//---------------
		// create node Id
		//---------------
		_createNodeId: function () {
			this.nextNodeId = this.nextNodeId + 1;
			return "N" + this.nextNodeId;
		},

		//---------------
		// get Index of Element in Array
		//---------------
		_getIndexOfElementInArray: function (aLines, oLine) {
			for (var i = 0; i < aLines.length; i++) {
				if (aLines[i].from === oLine.from && aLines[i].to === oLine.to) {
					return i;
				}
			}
			return -1;
		},

		//---------------------------------------
		// resize Node (if needed)
		//---------------------------------------
		_resizeNode: function (oNode) {
			var iColumns = oNode.childNodes.length / 8;
			iColumns = Math.ceil(iColumns);
			var iColumnPadding = 20;
			if (iColumns === 1) {
				iColumnPadding = 16;
			}
			oNode.width = (iColumns * this.iSmallSingleObjectWidth) + (iColumns * iColumnPadding);
			oNode.height = this._calculateNodeHeight(iColumns, oNode.childNodes.length);
			return oNode;
		},

		//---------------------------------------
		// calculate height of Node
		//---------------------------------------
		_calculateNodeHeight: function (iColumns, iNumberfOfItems) {
			var iHeight;
			if (iNumberfOfItems <= 4) {
				iHeight = (iNumberfOfItems * this.iSmallSingleObjectHeight) + (iNumberfOfItems * 10); //n items a 70px per colum plus spacing 
			} else if (iNumberfOfItems > 8) {
				var iItemsPerColumn = Math.ceil(iNumberfOfItems / iColumns);
				iHeight = iItemsPerColumn * this.iSmallSingleObjectHeight + (iItemsPerColumn * 9);
			} else {
				iHeight = (iNumberfOfItems * this.iSmallSingleObjectHeight) + (iNumberfOfItems * 9); //n items a 70px per colum plus spacing 					
			}
			return iHeight;
		},

		//---------------------------------------
		// move Children into a BOX node
		//---------------------------------------
		_moveChildrenInBox: function (oGraphData, oObject) {
			// create BOX node
			var oBoxObject = this._createNodeObject({
				id: "D" + this._createNodeId(), //ID is D with the ID of the manager
				parentId: oObject.id,
				objectId: oObject.objectId,
				objectType: oObject.objectType,
				parentObjectId: oObject.objectId,
				parentObjectType: oObject.objectType,
				isBoxNode: true
			});
			oObject.renderingWidth = 0;
			oObject.x = 0;
			oObject.y = 0;

			var aChildNodes = oObject.childNodes;
			oObject.childNodes = [];
			oObject.childNodes.push(oBoxObject);

			// loop over all kids and put them in a Box
			aChildNodes.forEach(function (oChildNode) {

				oChildNode.renderingWidth = 0;
				oChildNode.x = 0;
				oChildNode.y = 0;

				if (oChildNode.numChildren > 0 && oChildNode.expanded) {
					oChildNode.keepBoxStyle = true;
					oObject.childNodes.push(oChildNode); //set this EE as child again as it is expanded and not in the BOX 

					// check if subtree of the child is already in BoxStyle
					var bResizeNeeded = !oChildNode.childNodes.some(function (currentValue) {
						return (currentValue.id.substring(0, 1) === "D") || (currentValue.wasInBox);
					});

					// check if subtree of sibling(s) is already in BoxStyle
					if (bResizeNeeded) {
						for (var i = 0; i < aChildNodes.length; i++) {
							if (aChildNodes[i].id !== oChildNode.id) {
								bResizeNeeded = !aChildNodes[i].childNodes.some(function (currentValue) {
									return (currentValue.id.substring(0, 1) === "D") || (currentValue.wasInBox);
								});
							}
							if (!bResizeNeeded) {
								break;
							}
						}
					}

					// now resize the child with it's subtree
					oChildNode.wasInBox = true;
					if (bResizeNeeded) {
						this._moveChildrenInBox(oGraphData, oChildNode);
					}
				} else {
					oChildNode.wasInBox = true;
					oBoxObject.childNodes.push(oChildNode);
					oGraphData.nodes = this._removeNode(oGraphData.nodes, oChildNode.id);
					oGraphData.lines = this._removeLine(oGraphData.lines, oChildNode.id);
				}

			}, this);

			// update Nodes + Lines with new objects
			oBoxObject = this._resizeNode(oBoxObject);
			oGraphData.nodes.push(oBoxObject);
			oGraphData.lines.push({
				from: oObject.id,
				to: oBoxObject.id
			});
		}

	});

	return OrgChartControl;
});
