/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/lib/common/block/PersInfoDisplayWrapperBlock",
	"hcm/fab/lib/common/block/PersInfoEditWrapperBlock",
	"hcm/fab/lib/common/block/PersInfoEmptyBlock",
	"hcm/fab/lib/common/controls/ConcurrentEmploymentObjectPageHeaderActionButton",
	"hcm/fab/lib/common/controls/OnBehalfIndicator",
	"hcm/fab/lib/common/util/CommonModelManager",
	"hcm/fab/lib/common/util/DateUtil",
	"sap/f/DynamicPage",
	"sap/m/Button",
	"sap/m/Image",
	"sap/m/NavContainer",
	"sap/m/OverflowToolbar",
	"sap/m/OverflowToolbarButton",
	"sap/m/ObjectStatus",
	"sap/m/ToolbarSpacer",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/m/semantic/FullscreenPage",
	"sap/m/semantic/SaveAction",
	"sap/m/semantic/CancelAction",
	"sap/m/semantic/MessagesIndicator",
	"sap/ui/Device",
	"sap/ui/core/Control",
	"sap/ui/core/Locale",
	"sap/ui/core/format/DateFormat",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/uxap/BlockBase",
	"sap/uxap/ObjectPageLayout",
	"sap/uxap/ObjectPageHeader",
	"sap/uxap/ObjectPageHeaderActionButton",
	"sap/uxap/ObjectPageHeaderContent",
	"sap/uxap/ObjectPageSection",
	"sap/uxap/ObjectPageSubSection"
], function (
	PersInfoDisplayWrapperBlock,
	PersInfoEditWrapperBlock,
	PersInfoEmptyBlock,
	ConcurrentEmploymentObjectPageHeaderActionButton,
	OnBehalfIndicator,
	CommonModelManager,
	DateUtil,
	DynamicPage,
	Button,
	Image,
	NavContainer,
	OverflowToolbar,
	OverflowToolbarButton,
	ObjectStatus,
	ToolbarSpacer,
	MessageBox,
	MessageToast,
	MessagePopover,
	MessagePopoverItem,
	FullscreenPage,
	SaveAction,
	CancelAction,
	MessagesIndicator,
	Device,
	Control,
	Locale,
	DateFormat,
	JSONModel,
	Filter,
	FilterOperator,
	BlockBase,
	ObjectPageLayout,
	ObjectPageHeader,
	ObjectPageHeaderActionButton,
	ObjectPageHeaderContent,
	ObjectPageSection,
	ObjectPageSubSection
) {
	"use strict";

	var PersInfoControl = Control.extend("hcm.fab.lib.common.controls.PersInfoControl", {
		metadata: {
			library: "hcm.fab.lib.common",
			properties: {
				oDataModelName: {
					type: "string",
					defaultValue: ""
				},
				entityMapModelName: {
					type: "string"
				},
				infotype: {
					type: "string"
				},
				applicationId: {
					type: "string"
				},
				assignmentId: {
					type: "string"
				},
				countryViewsFolder: {
					type: "string"
				},
				height: {
					type: "sap.ui.core.CSSSize",
					defaultValue: "100%"
				}
			},
			aggregations: {
				_navContainer: {
					type: "sap.m.NavContainer",
					multiple: false,
					visibility: "hidden"
				}
			}
		},

		init: function () {
			if (Control.prototype.init) {
				Control.prototype.init.apply(this, arguments);
			}

			this._oODataModel = null;
			this._oEntityMap = null;
			this._oBlockList = {};
			this._oImageControl = null;
			this._oChangePictureAction = null;
			this._oGlobalInformationModel = new JSONModel({
				employeeNumber: null, // data for this PERNR is shown; either an onbehalf employee (if it is activated) or an CE contract
				defaultVersionId: null,
				mappedVersionId: null,
				infotype: null,
				serviceName: null,
				selectedSubtype: null,
				currentMode: "DISPLAY", //possible modes: DISPLAY; EDIT; CREATE
				numberOfSubtypes: null,
				hasSubtypes: false,
				isSelectedSubtypeCreatable: false,
				isEmplLookupAvailable: false,
				applicationId: null,
				photoDate: new Date(),
				validPictureChosen: false,
				sMimeTypeErrorText: "",
				sMimeTypeInfoText: "",
				isTypeMismatch: false,
				aValidMimeTypes: ["image/jpeg"],
				refreshMainPage: false,
				isEmployeePictureVisible: true,
				isEmployeeNumberVisible: true,
				isChangePictureEnabled: true,
				showEmployeeNumberWithoutZeros: false,
				messagePageCreateButtonText: ""
			});

			this._oEditPagePropertiesModel = new JSONModel({
				validityBeginDateVisible: null,
				validityEndDateVisible: null,
				validityTypeSelectedKey: null,
				validityTypeVisible: null,
				validityFormVisible: null,
				validityTypes: [],
				countrySelectorVisible: null,
				subtypeSelectorVisible: null,
				selectedSubtype: null,
				selectedSubtypeText: null,
				selectedAddressCountryId: null,
				recordTitle: null,
				subtypes: []
			});

			this._oCountryViewPropertiesModel = new JSONModel({
				versionId: null,
				originalBeginDate: null,
				originalEndDate: null,
				currentMode: null
			});

			this._oEditPageMessageManager = sap.ui.getCore().getMessageManager();
			this._oMessageProcessor = new sap.ui.core.message.ControlMessageProcessor();
			this._oEditPageMessageManager.registerMessageProcessor(this._oMessageProcessor);
			this.setModel(this._oEditPageMessageManager.getMessageModel(), "message");

			this._oCrossAppNavigator = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService("CrossApplicationNavigation");
			this._initCrossAppNavigationSettings(this._oCrossAppNavigator);

			this.setModel(this._oGlobalInformationModel, "GlobalInformation");
			this.setModel(CommonModelManager.getI18NModel(), "libI18N");
			this.setModel(CommonModelManager.getModel(), "libCommon");

			// decisions based on the service metadata
			this._bUseToPictureNavigation = false;
			var oMetaModel = CommonModelManager.getModel().getMetaModel();
			oMetaModel.loaded().then(function () {
				var sNamespace = oMetaModel.getProperty("/dataServices/schema/0/namespace");
				var oEmployeeDetail = oMetaModel.getODataEntityType(sNamespace + ".EmployeeDetail");
				var oToEmployeePicture = oMetaModel.getODataAssociationEnd(oEmployeeDetail, "ToEmployeePicture");
				this._bUseToPictureNavigation = (oToEmployeePicture.multiplicity !== "*");
			}.bind(this));

			var oNavContainer = new NavContainer({
				id: this._createId("navContainer"),
				height: "inherit"
			});

			//**********************************************************
			// Main Page (Object Page Layout for displaying the records)
			//**********************************************************

			// Create ObjectPageLayout and add it to the NavContainer
			var oFullscreenDisplayPage = new FullscreenPage({
				id: this._createId("mainPage"),
				busyIndicatorDelay: 0,
				showNavButton: true,
				showSubHeader: false,
				showFooter: false,
				floatingFooter: true,
				enableScrolling: false,
				semanticRuleSet: "Optimized",
				navButtonPress: this.onNavBack.bind(this)
			});

			var oObjectPageLayoutDisplay = new ObjectPageLayout({
				id: this._createId("displayObjectPageLayout"),
				busyIndicatorDelay: 0,
				enableLazyLoading: false,
				useIconTabBar: "{= ${GlobalInformation>/hasSubtypes} ? ${GlobalInformation>/numberOfSubtypes} > '1' : true }",
				showTitleInHeaderContent: false,
				showFooter: false,
				subSectionLayout: "TitleOnTop",
				showAnchorBarPopover: false,
				upperCaseAnchorBar: false,
				useTwoColumnsForLargeScreen: false,
				navigate: this.onTabNavigation.bind(this)
			});

			// var aDisplayHeaderContent = sap.ui.xmlfragment(this.getId(), "hcm.fab.lib.common.view.fragment.PersInfoHeaderContent", this);
			// var oObjectPageHeader = sap.ui.xmlfragment(this._createId("displayHeader"), "hcm.fab.lib.common.view.fragment.PersInfoHeaderTitle",
			// 	this);

			// aDisplayHeaderContent.forEach(function(oObjectPageHeaderContent) {
			// 	oObjectPageLayoutDisplay.addHeaderContent(oObjectPageHeaderContent);
			// });

			// oObjectPageLayoutDisplay.setHeaderTitle(oObjectPageHeader);

			var oOnBehalfMessageStripDisplay = new OnBehalfIndicator({
				id: this._createId("onBehalfIndicatorDisplay"),
				applicationId: "{GlobalInformation>/applicationId}"
			});

			oFullscreenDisplayPage.addContent(oOnBehalfMessageStripDisplay);
			oFullscreenDisplayPage.addContent(oObjectPageLayoutDisplay);

			oNavContainer.addPage(oFullscreenDisplayPage);

			//**********************************************************
			// Edit Page (Create or Edit a record)
			//**********************************************************

			// Create ObjectPageLayout and add it to the NavContainer
			var oFullscreenEditPage = new FullscreenPage({
				id: this._createId("editPage"),
				busyIndicatorDelay: 0,
				showNavButton: true,
				showSubHeader: false,
				showFooter: true,
				floatingFooter: true,
				enableScrolling: false,
				semanticRuleSet: "Optimized",
				navButtonPress: this.onNavBack.bind(this),
				saveAction: new SaveAction({
					id: this._createId("btnSave"),
					press: this.onSave.bind(this)
				}),
				cancelAction: new CancelAction({
					id: this._createId("btnCancel"),
					press: this.onCancel.bind(this)
				}),
				messagesIndicator: new MessagesIndicator({
					id: this._createId("btnMessages"),
					visible: "{= !!${message>/length}}",
					press: this.onMessagesButtonPress.bind(this)
				})
			});

			oFullscreenEditPage.setModel(this._oEditPagePropertiesModel, "UIProperties");

			var oObjectPageLayoutEdit = new ObjectPageLayout({
				id: this._createId("editObjectPageLayout"),
				busyIndicatorDelay: 0,
				enableLazyLoading: false,
				useIconTabBar: true,
				showTitleInHeaderContent: false,
				showFooter: false,
				subSectionLayout: "TitleOnTop",
				showAnchorBarPopover: false,
				flexEnabled: true,
				upperCaseAnchorBar: false,
				navigate: this.onTabNavigation.bind(this)
			});

			var oOnBehalfMessageStripEdit = new OnBehalfIndicator({
				id: this._createId("onBehalfIndicatorEdit"),
				applicationId: "{GlobalInformation>/applicationId}"
			});

			oFullscreenEditPage.addContent(oOnBehalfMessageStripEdit);
			oFullscreenEditPage.addContent(oObjectPageLayoutEdit);

			oNavContainer.addPage(oFullscreenEditPage);

			this.setAggregation("_navContainer", oNavContainer);
		},

		exit: function () {
			if (Control.prototype.exit) {
				Control.prototype.exit.apply(this, arguments);
			}
			CommonModelManager.resetApplicationState(this.getApplicationId());
		},

		renderer: function (oRM, oControl) {
			oRM.write("<div");
			oRM.writeControlData(oControl);
			oRM.writeClasses();

			oRM.addStyle("height", oControl.getHeight());
			oRM.writeStyles();

			oRM.write(">");

			oRM.renderControl(oControl.getAggregation("_navContainer"));

			oRM.write("</div>");
		},

		getAccessibilityInfo: function () {
			return this.getAggregation("_navContainer").getAccessibilityInfo();
		},

		setInfotype: function (infotype) {
			this.setProperty("infotype", infotype);
			this._oGlobalInformationModel.setProperty("/infotype", infotype);
			this._queueReadRequest();
		},

		setApplicationId: function (applicationId) {
			this.setProperty("applicationId", applicationId);
			this._oGlobalInformationModel.setProperty("/applicationId", applicationId);
			this._queueReadRequest();
		},

		setoDataModelName: function (sODataModelName) {
			this.setProperty("oDataModelName", sODataModelName);
			this._queueReadRequest();
		},

		setEntityMapModelName: function (sEntityMapModelName) {
			this.setProperty("entityMapModelName", sEntityMapModelName);
			this._queueReadRequest();
		},

		setCountryViewsFolder: function (sCountryViewsFolder) {
			this.setProperty("countryViewsFolder", sCountryViewsFolder);
			this._queueReadRequest();
		},

		setAssignmentId: function (sAssignmentId) {
			var oDisplayPage = sap.ui.getCore().byId(this._createId("mainPage")),
				sApplicationId = this._oGlobalInformationModel.getProperty("/applicationId");

			if (oDisplayPage && sAssignmentId) {
				var sPath = "/" + this.getModel("libCommon").createKey("EmployeeDetailSet", {
					EmployeeNumber: sAssignmentId,
					ApplicationId: sApplicationId
				});

				this._oGlobalInformationModel.setProperty("/employeeNumber", sAssignmentId);
				this.setProperty("assignmentId", sAssignmentId);

				oDisplayPage.bindElement({
					path: sPath,
					model: "libCommon",
					parameters: {
						expand: "ToManager,ToEmployeePicture"
					}
				});

				CommonModelManager.getAssignmentInformation(sAssignmentId, sApplicationId).then(function (assignmentInformation) {
					this._oGlobalInformationModel.setProperty("/defaultVersionId", assignmentInformation.DefaultVersionId);
					if (assignmentInformation.hasOwnProperty("ShowEmployeePicture")) {
						this._oGlobalInformationModel.setProperty("/isEmployeePictureVisible", assignmentInformation.ShowEmployeePicture);
						this._oGlobalInformationModel.setProperty("/isEmployeeNumberVisible", assignmentInformation.ShowEmployeeNumber);
						this._oGlobalInformationModel.setProperty("/isChangePictureEnabled", assignmentInformation.IsChangePictureEnabled);
						this._oGlobalInformationModel.setProperty("/showEmployeeNumberWithoutZeros", assignmentInformation.ShowEmployeeNumberWithoutZeros);
					}
					this._queueReadRequest();
				}.bind(this));
			}
		},

		onAssignmentChanged: function (oEvent) {
			this._refreshMainPage(true);
			this.setAssignmentId(oEvent.getParameter("selectedAssignment"));
		},

		onNavBack: function (oEvent) {
			if (this._oGlobalInformationModel.getProperty("/currentMode") !== "DISPLAY") {
				this._cancelAndNavigateBack();
			} else {
				var sPreviousHash = sap.ui.core.routing.History.getInstance().getPreviousHash();
				if (sPreviousHash !== undefined || !this._oCrossAppNavigator.isInitialNavigation()) {
					this._oCrossAppNavigator.historyBack(1);
				} else {
					// Navigate back to FLP home
					this._oCrossAppNavigator.toExternal({
						target: {
							shellHash: this._oCrossAppNavigator.hrefForExternal({
								target: {
									shellHash: "#"
								}
							})
						}
					});
				}
			}
		},

		onCreate: function () {
			var sDefaultVersionId = this._oGlobalInformationModel.getProperty("/defaultVersionId");
			this._buildCreateScreen(sDefaultVersionId);
		},

		onDelete: function (oEvent) {
			var sPath = oEvent.getParameter("sPath");
			var sMessageText = this.getModel("libI18N").getProperty("persInfoDeleteRecordQuestion");

			MessageBox.confirm(
				sMessageText, {
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.OK) {
							var oMainPage = sap.ui.getCore().byId(this._createId("mainPage"));
							oMainPage.setBusy(true);
							//Delete the record
							this._oODataModel.remove(sPath, {
								success: function (oRemoveEvent) {
									this._refreshMainPage();
									// oMainPage.setBusy(false);
									MessageToast.show(this.getModel("libI18N").getProperty("persInfoSuccessfullyDeleted"));
								}.bind(this),
								error: function (oRemoveEvent) {
									oMainPage.setBusy(false);
									//Check whether the record key changed -> refresh main page
									if (oRemoveEvent.responseText.indexOf("HCMFAB_COMMON/009") !== -1) {
										var sActionButton = this.getModel("libI18N").getProperty("actionRelaunchButtonText");
										MessageBox.error(
											this.getModel("libI18N").getProperty("persInfoRecordChanged"), {
												id: "ETagErrorMessageBox",
												actions: [sActionButton],
												onClose: function (sAction) {
													if (sAction === sActionButton) {
														this._refreshMainPage();
													}
												}.bind(this)
											}
										);
									} else if (oRemoveEvent.responseText.indexOf("PBAS_SERVICE/001") !== -1) {
										MessageToast.show(this.getModel("libI18N").getProperty("persInfoEmployeeLocked"));
										oMainPage.setBusy(false);
										return;
									}
								}.bind(this)
							});
						} else {
							// Do Nothing
						}
					}.bind(this)
				});
		},

		onChangePicture: function () {
			var oView = sap.ui.getCore().byId(this._createId("mainPage"));
			if (!this._oDialogChangePhoto) {
				this._oDialogChangePhoto = sap.ui.xmlfragment(this.getId(), "hcm.fab.lib.common.view.fragment.PersInfoPictureUpload", this);
				jQuery.sap.syncStyleClass(this._getContentDensityClass(), oView, this._oDialogChangePhoto);
				this.addDependent(this._oDialogChangePhoto);
				var sText = this.getModel("libI18N").getProperty("uploadPicMimeTypes").replace("{0}", this._oGlobalInformationModel.getProperty(
					"/aValidMimeTypes").join(", "));
				this._oGlobalInformationModel.setProperty("/sMimeTypeInfoText", sText);
			}
			this._oDialogChangePhoto.open();
		},

		onChangeSubtype: function (oEvent) {
			var sSelectedSubtype = oEvent.getSource().getSelectedKey();
			this._oGlobalInformationModel.setProperty("/selectedSubtype", sSelectedSubtype);
			var sDefaultVersionId = this._oGlobalInformationModel.getProperty("/defaultVersionId");
			var oEditPage = sap.ui.getCore().byId(this._createId("editPage"));
			this._oODataModel.deleteCreatedEntry(oEditPage.getBindingContext());
			this._buildCreateScreen(sDefaultVersionId);

		},

		onChangeMyAdressesCountry: function (oEvent) {
			var oEditPage = sap.ui.getCore().byId(this._createId("editPage"));
			var aValueHelpItems = oEditPage.getModel("ValueHelpCountrySwitchMyAddresses").getData();
			var sCountryId = oEvent.getSource().getSelectedKey();

			//we have the selected countryId from the Select. Now find the item in the value
			//help model that matches the key and take its versionId to proceed. 
			var aItemsFound = aValueHelpItems.filter(function (oItem) {
				return oItem.CountryId === sCountryId;
			});
			if (aItemsFound.length !== 1) {
				//not exactly one item found. Can't happen actually.
				return;
			}

			var sVersionId = aItemsFound[0].VersionId;
			this._oEditPagePropertiesModel.setProperty("/selectedAddressCountryId", sCountryId);
			this._oODataModel.deleteCreatedEntry(oEditPage.getBindingContext());
			this._buildCreateScreen(sVersionId, sCountryId);
		},

		onValidityDateChange: function (oEvent) {
			this._doFieldValidation(oEvent);
			this._publishValidityChangedEvent();
		},

		onEdit: function (oEvent) {
			this._oEditPageMessageManager.removeAllMessages();

			var sPath = oEvent.getParameter("sPath"),
				oViewInitEvent = sap.uxap.BlockBase.getMetadata().getEvent("viewInit"),
				oCountryWrapperBlock;
			if (oViewInitEvent) {
				oCountryWrapperBlock = new PersInfoEditWrapperBlock({
					mode: "Expanded",
					viewInit: this.onEditViewInit.bind(this),
					customData: [{
						key: "sPath",
						value: sPath
					}]
				});
			} else {
				oCountryWrapperBlock = new PersInfoEditWrapperBlock({
					mode: "Expanded"
				});
			}

			if (!oViewInitEvent) {
				var oContainer = sap.ui.getCore().byId(oCountryWrapperBlock.getSelectedView()).getContent()[0];
				this._handleOnEdit(sPath, oCountryWrapperBlock, oContainer);
			}

		},

		_handleOnEdit: function (sPath, oCountryWrapperBlock, oContainer) {
			var sEntitySetName = sPath.substr(1, sPath.indexOf("(") - 1),
				sExpandString = this._buildExpandString(null, sEntitySetName, false),
				oMainPage = sap.ui.getCore().byId(this._createId("mainPage"));

			oMainPage.setBusy(true);

			this._oODataModel.read(sPath, {
				urlParameters: {
					"$expand": sExpandString
				},
				success: function (oCountryRecord) {
					this._oGlobalInformationModel.setProperty("/currentMode", "EDIT");

					this._destroyEditPage();

					var oFieldStateBuildResult = this._buildFieldStatesModel(oCountryRecord.toFieldMetaData.results, "EDIT");

					if (!oFieldStateBuildResult.sIsEditModeAvailable) {
						MessageToast.show(this.getModel("libI18N").getProperty("persInfoEmployeeLocked"));
						this._oGlobalInformationModel.setProperty("/currentMode", "DISPLAY"); //reset the mode to display
						oMainPage.setBusy(false);
						return;
					}

					var oCountryView = this._getCountryView(oCountryRecord.EditScreen),
						sVersionIdUsed = this._getVersionIdFromPath(sPath),
						oBeginDate = this._oODataModel.getProperty(sPath + "/BeginDate"),
						oEndDate = this._oODataModel.getProperty(sPath + "/EndDate"),
						oSection = new ObjectPageSection(),
						oSubSection = new ObjectPageSubSection(),
						oEditObjectPageLayout = sap.ui.getCore().byId(this._createId("editObjectPageLayout")),
						sSelectedSubytype = this._oGlobalInformationModel.getProperty("/selectedSubtype");

					oSubSection.addBlock(oCountryWrapperBlock);
					oSection.addSubSection(oSubSection);
					oEditObjectPageLayout.addSection(oSection);

					this._fillCountryViewPropertiesModel(oCountryView, sVersionIdUsed, oBeginDate, oEndDate, "EDIT");
					this._attachChangeEventToFields(oCountryView);
					this._addEditPageHeader("EDIT");
					this._attachValueHelpsToEditPage(sPath, null, null);

					oContainer.addItem(oCountryView);

					this._addValidityFragment(oContainer, true);

					//build Validity Fields Properties
					this._fillValidityFieldsPropertiesModel(oCountryRecord.toValidityInfo.results, sPath);

					//set subtype information
					this._oEditPagePropertiesModel.setProperty("/selectedSubtype", sSelectedSubytype);
					this._oEditPagePropertiesModel.setProperty("/selectedSubtypeText", this._getSubtypeTextForSubtypeId(sSelectedSubytype));

					var oEditPage = sap.ui.getCore().byId(this._createId("editPage"));
					oEditPage.setModel(oFieldStateBuildResult.oFieldStatesModel, "FieldStates");
					oEditPage.bindElement(sPath);

					sap.ui.getCore().getEventBus().publish("hcm.fab.lib.common", "refreshFormGroupsVisibility");

					var oNavContainer = this.getAggregation("_navContainer");
					oNavContainer.to(this._createId("editPage"), "slide");

					oMainPage.setBusy(false);

					this._setShowExceptionsOnly(true);

				}.bind(this),
				error: function (oReadEvent) {
					oMainPage.setBusy(false);
					//An error occured when retrieving the expands for the record. At this point we have no value helps, etc. 
					//Check whether the record key changed -> refresh main page
					if (oReadEvent.responseText.indexOf("HCMFAB_COMMON/009") !== -1) {
						var sActionButton = this.getModel("libI18N").getProperty("actionRelaunchButtonText");
						MessageBox.error(
							this.getModel("libI18N").getProperty("persInfoRecordChanged"), {
								id: "ETagErrorMessageBox",
								actions: [sActionButton],
								onClose: function (sAction) {
									if (sAction === sActionButton) {
										this._refreshMainPage();
									}
								}.bind(this)
							}
						);
					}
				}.bind(this)
			});
		},

		onCancel: function () {
			this._cancelAndNavigateBack();
		},

		onSave: function (oEvent) {
			this._oEditPageMessageManager.removeAllMessages();

			var oEditPage = sap.ui.getCore().byId(this._createId("editPage")),
				sPath = oEditPage.getBindingContext().getPath();
			if (sPath.indexOf("/") === 0) {
				sPath = sPath.substring(1);
			}

			var oChangedData = this._oODataModel.getPendingChanges()[sPath],
				oDefaultDates = this._getDefaultDatesForValidityType(this._determineInitialValidityTypeForPreSelection()),
				bCanSave = false,
				bIsInputError = false;
			for (var property in oChangedData) {
				if (oChangedData.hasOwnProperty(property) && !bCanSave) {
					// begda
					if (property === "BeginDate") {
						var dChangedBeginDate = oChangedData.valueOf("BeginDate").BeginDate,
							oBeginDate = sap.ui.getCore().byId(this._createId("inpBeginDate"));
						if (oBeginDate.getValueState() === sap.ui.core.ValueState.Error) {
							bIsInputError = true;
						} else if (oDefaultDates.beginDate !== dChangedBeginDate && !bIsInputError) {
							bCanSave = true;
						}
					}

					// endda
					if (property === "EndDate") {
						var dChangedEndDate = oChangedData.valueOf("EndDate").EndDate,
							oEndDate = sap.ui.getCore().byId(this._createId("inpEndDate"));
						if (oEndDate.getValueState() === sap.ui.core.ValueState.Error) {
							bIsInputError = true;
						} else if (oDefaultDates.endDate !== dChangedEndDate) {
							bCanSave = true;
						}
					}

					// other fields
					if (property !== "BeginDate" && property !== "EndDate" && property !== "__metadata") {
						bCanSave = true;
					}
				}
			}
			if (!bCanSave && !bIsInputError) {
				MessageToast.show(this.getModel("libI18N").getProperty("persInfoNoChangeNoSave"));
				return;
			}

			var aValidationGroupElements = oEditPage.getControlsByFieldGroupId("PersInfoValidation"),
				bValid = true,
				oCountryView = "";

			//validate all fields
			aValidationGroupElements.forEach(function (oElement) {
				try {
					oCountryView = sap.ui.getCore().byId(this._createId("CountryView"));
					bValid = oCountryView.getController().validateField(oElement, oEvent, true);

					if (!bValid) {
						//prevent calling the backend
						bCanSave = false;
					}
				} catch (err) {
					//Reading the required attribute can go wrong when the AbapFieldName is not part of the 
					//FieldStatesModel. Prevent the dump but ignore the problem and just don't check for required. 
					//Why is it not part of the Model in the first place?
				}
			}.bind(this));

			if (!bCanSave) {
				//sap.ui.getCore().byId(this._createId("btnMessages")).focus();
				setTimeout(function () {
					this.onMessagesButtonPress(null);
				}.bind(this), 0);

				return;
			}

			oEditPage.setBusy(true);

			var sCurrentMode = this._oGlobalInformationModel.getProperty("/currentMode");
			switch (sCurrentMode) {
			case "CREATE":
				//Write back the real country key in case of an internationalized country
				if (this._oGlobalInformationModel.getProperty("/infotype") === "0006" && this._oODataModel.getProperty(sPath + "/CountryId") ===
					"99") {
					this._oODataModel.setProperty(sPath + "/CountryId", this._oEditPagePropertiesModel.getProperty("/selectedAddressCountryId"));
				}
				break;
			}

			this._oODataModel.setRefreshAfterChange(false);

			//submit the changes to the server
			this._oODataModel.submitChanges({
				success: function (oResultData, oResponse) {
					var oBatchResponse = oResponse.data.__batchResponses[0],
						oSingleResponse = {};
					if (oBatchResponse.response) {
						oSingleResponse = oBatchResponse.response;
					} else if (oBatchResponse.__changeResponses) {
						oSingleResponse = oBatchResponse.__changeResponses[0];
					}
					if (oSingleResponse.statusCode.substr(0, 1) === "2") {
						//success
						this._oGlobalInformationModel.setProperty("/refreshMainPage", true);
						this._leaveEditPage();
						MessageToast.show(this.getModel("libI18N").getProperty("persInfoSuccessfullySaved"));
					} else {
						//error
						if ((oSingleResponse.body.indexOf("/IWBEP/CM_MGW_RT/190") !== -1) ||
							(oSingleResponse.body.indexOf("HCMFAB_COMMON/009") !== -1)) {
							//we're in the 'if-none-match'-case of ETag handling here
							var sActionButton = this.getModel("libI18N").getProperty("actionRelaunchButtonText");
							MessageBox.error(
								this.getModel("libI18N").getProperty("persInfoRecordChanged"), {
									id: "ETagErrorMessageBox",
									actions: [sActionButton, MessageBox.Action.CLOSE],
									onClose: function (sAction) {
										oEditPage.setBusy(false);
										this._oGlobalInformationModel.setProperty("/refreshMainPage", true);
										if (sAction === sActionButton) {
											this._leaveEditPage();
										}
									}.bind(this)
								}
							);
							return;
						}

						//sap.ui.getCore().byId(this._createId("btnMessages")).focus();

						setTimeout(function () {
							this.onMessagesButtonPress(null);
						}.bind(this), 0);

					}
					oEditPage.setBusy(false);

				}.bind(this),
				error: function (oError) {
					oEditPage.setBusy(false);
				}.bind(this)
			});
		},

		onChangeValidityType: function (oEvent) {
			var oEditPage = sap.ui.getCore().byId(this._createId("editPage"));
			var sValidityTypeSelectedKey = oEvent.getSource().getSelectedKey();
			this._updateValidityFieldsModel(sValidityTypeSelectedKey);

			//Change the begin and end date of the record to be edited according to the default dates provided by the customizing. 
			var oDefaultDates = this._getDefaultDatesForValidityType(sValidityTypeSelectedKey);
			var sPath = oEditPage.getBindingContext().getPath();

			var dOldBeginDate = this._oODataModel.getProperty(sPath + "/BeginDate");
			var dOldEndDate = this._oODataModel.getProperty(sPath + "/EndDate");

			this._oODataModel.setProperty(sPath + "/BeginDate", oDefaultDates.beginDate);
			this._oODataModel.setProperty(sPath + "/EndDate", oDefaultDates.endDate);

			if (dOldBeginDate !== oDefaultDates.beginDate || dOldEndDate !== oDefaultDates.endDate) {
				this._publishValidityChangedEvent();
			}
		},

		onBreadCrumbBackClick: function (oEvent) {
			this._cancelAndNavigateBack();
		},

		onTabNavigation: function (oEvent) {
			var sSelectedSubtype = oEvent.getParameter("section").data("Subtype");
			this._oGlobalInformationModel.setProperty("/selectedSubtype", sSelectedSubtype);

			var bIsCreatable = this._getIsCreatableForSubtype(sSelectedSubtype);
			this._oGlobalInformationModel.setProperty("/isSelectedSubtypeCreatable", bIsCreatable);

			var sCreateButtonText = "";
			if (sap.m.MessagePage.getMetadata().hasProperty("enableFormattedText")) {
				sCreateButtonText = this.getModel("libI18N").getProperty("persInfoNoRecordsClickButton");
			} else {
				sCreateButtonText = this.getModel("libI18N").getProperty("persInfoNoRecordsClickButtonUnformatted");
			}
			this._oGlobalInformationModel.setProperty("/messagePageCreateButtonText", sCreateButtonText);
		},

		onMessagesButtonPress: function (oEvent) {

			if (oEvent === null) {
				var oMessagesButton = sap.ui.getCore().byId(this._createId("btnMessages")); //Opened by Save Action
			} else {
				var oMessagesButton = oEvent.getSource(); //Message Indicator Button Pressed
			}

			if (!this._messagePopover) {
				this._messagePopover = new MessagePopover({
					items: {
						path: "message>/",
						template: new MessagePopoverItem({
							description: "{message>description}",
							type: "{message>type}",
							title: "{message>message}"
						})
					}
				});
				oMessagesButton.addDependent(this._messagePopover);
			}
			this._messagePopover.toggle(oMessagesButton);
		},

		onUploadStarts: function (oEvent) {
			var oEventParameters = oEvent.getParameters(),
				sEncodedFileName = jQuery.sap.encodeURL(oEvent.getParameter("fileName"));

			oEventParameters.requestHeaders.push({
				name: "x-csrf-token",
				value: CommonModelManager.getModel().getSecurityToken()
			});
			oEventParameters.requestHeaders.push({
				name: "Content-Disposition",
				value: "attachment;filename=" + sEncodedFileName
			});
			oEventParameters.requestHeaders.push({
				name: "slug",
				value: sEncodedFileName
			});
		},

		onUploadPicture: function (oEvent) {
			var oFileUploader = sap.ui.getCore().byId(this._createId("fileUploaderEditHeaderDialog")),
				sPath = this.getModel("libCommon").createKey("EmployeeDetailSet", {
					EmployeeNumber: this.getAssignmentId(),
					ApplicationId: this._oGlobalInformationModel.getProperty("/applicationId")
				}),
				sUploadUrl = CommonModelManager.getServiceUrl() + sPath + "/ToEmployeePicture";

			this._oDialogChangePhoto.setBusy(true);

			oFileUploader.setUploadUrl(sUploadUrl);
			oFileUploader.upload();
		},

		onUploadComplete: function (oEvent) {
			this._oDialogChangePhoto.setBusy(false);

			var sStatus = oEvent.getParameter("status").toString().substr(0, 1),
				oFileUploader = sap.ui.getCore().byId(this._createId("fileUploaderEditHeaderDialog"));
			if (sStatus === "2") {
				this._oDialogChangePhoto.close();
				oFileUploader.clear();
				MessageToast.show(this.getModel("libI18N").getProperty("uploadPicSuccess"));
				this._refreshEmployeePicture();
			} else {
				CommonModelManager.getErrorHandler().showErrorMsg(oEvent);
			}
		},

		onDeletePicture: function (sBindingPath) {
			var sMessageText = this.getModel("libI18N").getProperty("persInfoDeletePictureQuestion");
			MessageBox.confirm(
				sMessageText, {
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.OK) {
							var oMainPage = sap.ui.getCore().byId(this._createId("mainPage"));
							var sPath = this.getModel("libCommon").createKey("EmployeePictureSet", {
								EmployeeId: this.getAssignmentId(),
								ApplicationId: this._oGlobalInformationModel.getProperty("/applicationId")
							});
							oMainPage.setBusy(true);
							this.getModel("libCommon").remove("/" + sPath, {
								success: function () {
									oMainPage.setBusy(false);
									MessageToast.show(this.getModel("libI18N").getProperty("deletePicSuccess"));
									this._oDialogChangePhoto.close();
									this._refreshEmployeePicture();
								}.bind(this),
								error: function (oError) {
									oMainPage.setBusy(false);
									MessageToast.show(this.getModel("libI18N").getProperty("deletePicError"));
								}.bind(this)
							});
						}
					}.bind(this)
				});
		},

		onClosePictureDialog: function () {
			var oFileUploader = sap.ui.getCore().byId(this._createId("fileUploaderEditHeaderDialog"));
			this._oDialogChangePhoto.close();
			oFileUploader.clear();
			this._oGlobalInformationModel.setProperty("/validPictureChosen", false);
			this._oGlobalInformationModel.setProperty("/isTypeMismatch", false);
		},

		onPictureFileAllowed: function (oEvent) {
			this._oGlobalInformationModel.setProperty("/validPictureChosen", true);
			this._oGlobalInformationModel.setProperty("/isTypeMismatch", false);
		},

		onPictureTypeMismatch: function (oEvent) {
			var sPhotoTypeError = this.getModel("libI18N").getProperty("persInfoUploadPicTypeError").replace("{0}", oEvent.getParameter(
				"mimeType"));
			this._oGlobalInformationModel.setProperty("/validPictureChosen", false);
			this._oGlobalInformationModel.setProperty("/sMimeTypeErrorText", sPhotoTypeError);
			this._oGlobalInformationModel.setProperty("/isTypeMismatch", true);
		},

		onPictureFilePathChanged: function (oEvent) {
			var oParameters = oEvent.getParameters();
			if (!oParameters.newValue && oParameters.files.length === 0) {
				this._oGlobalInformationModel.setProperty("/validPictureChosen", false);
			}
		},

		onHandlePhoneClick: function (oEvent) {
			sap.m.URLHelper.triggerTel(oEvent.getSource().getText());
		},

		onHandleMobileClick: function (oEvent) {
			sap.m.URLHelper.triggerTel(oEvent.getSource().getText());
		},

		onHandleEmailClick: function (oEvent) {
			sap.m.URLHelper.triggerEmail(oEvent.getSource().getText());
		},

		onOfficeInfoPress: function (oEvent) {
			if (!this._oOfficeInfoQuickView) {
				this._createOfficeInfoQuickView();
			}
			this._oOfficeInfoQuickView.openBy(oEvent.getSource());
		},

		onHandleManagerClick: function (oEvent) {
			if (!this._oManagerQuickView) {
				this._createManagerQuickView();
			}
			this._oManagerQuickView.openBy(oEvent.getSource());
		},

		onViewInit: function (oEvent) {
			var sCountryDisplayScreen = oEvent.getSource().data("countryDisplayScreen"),
				oContainer = oEvent.getParameter("view").getContent()[0],
				oCountryView = this._getCountryView(sCountryDisplayScreen);

			oContainer.addItem(oCountryView);

			sap.ui.getCore().getEventBus().publish("hcm.fab.lib.common", "refreshFormGroupsVisibility");

		},

		onEditViewInit: function (oEvent) {
			var oContainer = oEvent.getParameter("view").getContent()[0],
				sPath = oEvent.getSource().data("sPath"),
				oCountryWrapperBlock = oEvent.getParameter("view");

			this._handleOnEdit(sPath, oCountryWrapperBlock, oContainer);

		},

		onCreateViewInit: function (oEvent) {
			var oContainer = oEvent.getParameter("view").getContent()[0],
				sVersionId = oEvent.getSource().data("versionId"),
				sCountryId = oEvent.getSource().data("countryId"),
				oCountryWrapperBlock = oEvent.getParameter("view");

			this._handleOnCreate(sVersionId, sCountryId, oCountryWrapperBlock, oContainer);

		},

		_queueReadRequest: function () {
			if (this._queuedReadRequest) {
				jQuery.sap.clearDelayedCall(this._queuedReadRequest);
			}
			this._queuedReadRequest = jQuery.sap.delayedCall(0, this, "_readData");
		},

		_refreshMainPageHeader: function () {
			var oMainPage = sap.ui.getCore().byId(this._createId("mainPage"));
			oMainPage.getElementBinding("libCommon").refresh(true);
		},

		_refreshEmployeePicture: function () {
			this._oGlobalInformationModel.setProperty("/photoDate", new Date());
		},

		_readData: function () {
			//Check if all properties are filled
			if (!this.getProperty("assignmentId") ||
				!this.getProperty("entityMapModelName") ||
				!this.getProperty("infotype") ||
				!this.getProperty("countryViewsFolder") ||
				!this.getProperty("applicationId") ||
				!this._oGlobalInformationModel.getProperty("/defaultVersionId")) {
				return;
			}

			if (this.getProperty("oDataModelName")) {
				this._oODataModel = this.getModel(this.getProperty("oDataModelName"));
			} else {
				this._oODataModel = this.getModel();
			}

			this._oODataModel.setDefaultBindingMode("TwoWay");

			var oMainPage = sap.ui.getCore().byId(this._createId("mainPage"));
			oMainPage.setBusy(true);

			this._oEntityMap = this.getModel(this.getProperty("entityMapModelName"));
			var oMetaModel = this._oODataModel.getMetaModel();
			oMetaModel.loaded().then(function () {
				this._oGlobalInformationModel.setProperty("/serviceName", this.getModel().getServiceMetadata().dataServices.schema[0].namespace);

				var aFilters = [
					new Filter(
						"EmployeeNumber",
						sap.ui.model.FilterOperator.EQ,
						this._oGlobalInformationModel.getProperty("/employeeNumber")
					)
				];

				var oSubtypeAttributesSetPromise = new Promise(function (resolve, reject) {
					this._oODataModel.read("/SubtypeAttributesSet", {
						filters: aFilters,
						success: function (oSubtypeAttributesSetData) {
							var numberOfSubtypes = oSubtypeAttributesSetData.results.length;
							this._oGlobalInformationModel.setProperty("/numberOfSubtypes", numberOfSubtypes);

							var aSubtypes = [];
							oSubtypeAttributesSetData.results.forEach(function (oSubtypeAttributes, iIndex) {
								var oAttributes = {};
								oAttributes.subtypeId = oSubtypeAttributes.SubtypeId;
								oAttributes.subtypeText = oSubtypeAttributes.SubtypeText;
								oAttributes.isCreatable = oSubtypeAttributes.IsCreatable;
								if (oSubtypeAttributes.hasOwnProperty("HasSubtypes") && iIndex === 0) {
									this._oGlobalInformationModel.setProperty("/hasSubtypes", oSubtypeAttributes.HasSubtypes);
								}
								aSubtypes.push(oAttributes);
							}.bind(this));
							this._oEditPagePropertiesModel.setProperty("/subtypes", aSubtypes);

							if (aSubtypes.length === 0) {
								MessageBox.error(this.getModel("libI18N").getProperty("persInfoMissingInfotypeCustomizing"), {
									onClose: function () {
										reject();
									}
								});

							} else {
								resolve(oSubtypeAttributesSetData);
							}
						}.bind(this),
						error: function (oError) {
							reject(oError);
						}
					});

				}.bind(this));

				var sServiceName = this._oGlobalInformationModel.getProperty("/serviceName");
				var oEntityType = this._oODataModel.getMetaModel().getODataEntityType(sServiceName + ".MappedVersionId");
				var oMappedVersionIdSetPromise = new Promise(function (resolve, reject) {
					if (oEntityType) {
						var aMappedVersionIdFilters = [
							new Filter(
								"InfotypeId",
								sap.ui.model.FilterOperator.EQ,
								this._oGlobalInformationModel.getProperty("/infotype")
							),
							new Filter(
								"VersionId",
								sap.ui.model.FilterOperator.EQ,
								this._oGlobalInformationModel.getProperty("/defaultVersionId")
							)
						];
						this._oODataModel.read("/MappedVersionIdSet", {
							filters: aMappedVersionIdFilters,
							success: function (oMappedVersionIds) {
								this._oGlobalInformationModel.setProperty("/mappedVersionId", oMappedVersionIds.results[0].MapVersionId);
								resolve();
							}.bind(this),
							error: function (oError) {
								//although we ended in the error function we trigger a resolve() and just go on with the original defaultVersionId. 
								resolve();
							}
						});
					} else {
						resolve();
					}

				}.bind(this));

				if (this._oGlobalInformationModel.getProperty("/infotype") === "0006") { // for infotype 0006
					var oXXRecordsPromise = new Promise(function (resolve, reject) {
						this._oODataModel.read("/AddressSet", {
							filters: aFilters,
							success: function (oXXRecordsData) {
								resolve(oXXRecordsData);
							},
							error: function (oError) {
								reject(oError);
							}
						});
					}.bind(this));

					Promise.all([oSubtypeAttributesSetPromise, oXXRecordsPromise, oMappedVersionIdSetPromise]).then(function (aResults) {
							//handle the subtype results
							this._buildBasicUI(aResults[0]);

							//handle the results from reading all 'generic' XX records 
							this._readCountryRecordsForIT0006(aResults[1]);
						}.bind(this),
						function (reason) {
							oMainPage.setBusy(false);
						});

				} else { // for all infotypes other than IT0006
					Promise.all([oMappedVersionIdSetPromise]).then(function (aResults) {
						var sVersionId = this._oGlobalInformationModel.getProperty("/defaultVersionId");
						var oCountryReadPromise = new Promise(function (resolve, reject) {
							if (this._getEntitySetNameForVersionId(sVersionId)) {
								var sEntitySetName = this._getEntitySetNameForVersionId(sVersionId).entitySetName;
								this._oODataModel.read("/" + sEntitySetName, {
									urlParameters: {
										"$expand": "toFieldMetaData"
									},
									filters: aFilters,
									success: function (oCountryData) {
										resolve(oCountryData);
									},
									error: function (oError) {
										reject(oError);
									}
								});
							} else {
								resolve(null);
							}
						}.bind(this));

						Promise.all([oSubtypeAttributesSetPromise, oCountryReadPromise]).then(function (aResults) {
								//handle the subtype results
								this._buildBasicUI(aResults[0]);

								//handle the country records results
								if (aResults[1]) { //It could be null instead of emtpy in case we weren't able to read from the entity.
									//This can happen for country specific infotypes that do not have a 99 entity and are
									//called by an employee that does not fit the country the IT was made for. Came with IT0376
									aResults[1].results.forEach(function (oCountryRecord) {
										this._addRecordToMainPage(oCountryRecord);
									}.bind(this));

								} else {
									this._oGlobalInformationModel.setProperty("/isSelectedSubtypeCreatable", false);
								}

								this._addPlaceholdersToEmptySubtypes();
								this._selectSubtypeTab();
							}.bind(this),
							function (reason) {
								oMainPage.setBusy(false);
							});
					}.bind(this));
				}
			}.bind(this));
		},

		_getHeaderImageControl: function () {
			var currentUI5Version = (new sap.ui.core.Configuration()).getVersion(),
				sId = this._createId("employeePicture");

			if (currentUI5Version.getMinor() >= 46) {
				// employee picture shown as sap.f.Avatar
				this._oImageControl = new sap.f.Avatar(sId, {
					src: {
						formatter: this.formatEmployeeImageURL,
						parts: ["libCommon>", "GlobalInformation>/isEmployeePictureVisible", "GlobalInformation>/photoDate"]
					},
					displayShape: sap.f.AvatarShape.Circle,
					displaySize: sap.f.AvatarSize.L,
					imageFitType: sap.f.AvatarImageFitType.Cover
				});
			} else {
				// employee picture shown as sap.m.Image
				this._oImageControl = new Image(sId, {
					src: {
						formatter: this.formatEmployeeImageURL,
						parts: ["libCommon>", "GlobalInformation>/isEmployeePictureVisible", "GlobalInformation>/photoDate"]
					},
					height: "5rem",
					decorative: false,
					alt: "{libI18N>personalizationEmployeeListPictureColumnHeader}",
					tooltip: "{libI18N>personalizationEmployeeListPictureColumnHeader}",
					densityAware: false
				});
			}
			return this._oImageControl;
		},

		_addPictureToHeader: function (oObjectPageLayout) {
			// image control added to the object page header content
			this._oImageControl = this._getHeaderImageControl();
			oObjectPageLayout.insertHeaderContent(this._oImageControl, 0);

			// change picture action added to the object page header
			var oObjectPageHeader = oObjectPageLayout.getHeaderTitle();
			this._oChangePictureAction = new ObjectPageHeaderActionButton(this._createId("changePictureBtn"), {
				hideText: false,
				text: "{libI18N>persInfoChangePicture}",
				importance: "Low",
				press: this.onChangePicture.bind(this),
				visible: "{GlobalInformation>/isChangePictureEnabled}"
			});
			oObjectPageHeader.insertAction(this._oChangePictureAction, 1);
		},

		_removePictureFromHeader: function (oObjectPageLayout) {
			//remove employee picture from header
			oObjectPageLayout.removeHeaderContent(this._oImageControl);

			this._oImageControl.destroy();
			delete this._oImageControl;

			// remove change picture action from object page header
			var oObjectPageHeader = oObjectPageLayout.getHeaderTitle();
			oObjectPageHeader.removeAction(this._oChangePictureAction);

			this._oChangePictureAction.destroy();
			delete this._oChangePictureAction;
		},

		_buildBasicUI: function (oSubtypes) {
			//get the parent Object Page Layout to add the sections and subsections to
			var oObjectPageLayout = sap.ui.getCore().byId(this._createId("displayObjectPageLayout")),
				bIsEmployeePictureVisible = this._oGlobalInformationModel.getProperty("/isEmployeePictureVisible"),
				oSection = {};
			//add header title and header content
			var aDisplayHeaderContent = sap.ui.xmlfragment(this.getId(), "hcm.fab.lib.common.view.fragment.PersInfoHeaderContent", this);
			var oObjectPageHeader = sap.ui.xmlfragment(this._createId("displayHeader"),
				"hcm.fab.lib.common.view.fragment.PersInfoHeaderTitle",
				this);

			//call hook method to enable adjustment of header title and header content
			var oPageHeader = {
				oObjectPageHeaderTitle: oObjectPageHeader,
				aObjectPageHeaderContent: aDisplayHeaderContent
			};
			try {
				oPageHeader = this.getParent().getController().adjustObjectPageHeader(oPageHeader);
				//oObjectPageLayout.removeAllHeaderContent(oObjectPageLayout.getHeaderContent());
				oPageHeader.aObjectPageHeaderContent.forEach(function (oObjectPageHeaderContent) {
					oObjectPageLayout.addHeaderContent(oObjectPageHeaderContent);
				});
				oObjectPageLayout.setHeaderTitle(oPageHeader.oObjectPageHeaderTitle);
			} catch (err) {
				//app does not have the function or error occured. proceed with SAP standard header and title. 
				aDisplayHeaderContent.forEach(function (oObjectPageHeaderContent) {
					oObjectPageLayout.addHeaderContent(oObjectPageHeaderContent);
				});

				oObjectPageLayout.setHeaderTitle(oObjectPageHeader);
			}

			if (!this._oImageControl && bIsEmployeePictureVisible) {
				//add picture to object page header
				this._addPictureToHeader(oObjectPageLayout);
			} else if (this._oImageControl && !bIsEmployeePictureVisible) {
				//remove picture from object page header
				this._removePictureFromHeader(oObjectPageLayout);
			}
			//CORRECTION: we have to check whether this._oGlobalInformationModel.getProperty("/selectedSubtype")
			// is still in the list of available subtypes!
			//this list might have changed e.g. when acting 'on behalf'
			var sSelectedSubtypeId = this._oGlobalInformationModel.getProperty("/selectedSubtype");
			if (sSelectedSubtypeId) {
				var bSelectedSubtypeAvailable = oSubtypes.results.some(function (oSubtype) {
					return oSubtype.SubtypeId === sSelectedSubtypeId;
				});
				if (!bSelectedSubtypeAvailable) {
					this._oGlobalInformationModel.setProperty("/selectedSubtype", null);
				}
			}
			//Create an Object Page Section for each Subtype with the Subtypetext as title
			oSubtypes.results.forEach(function (oSubtype, i) {
				oSection = new ObjectPageSection({
					title: oSubtype.SubtypeText,
					titleUppercase: false,
					id: this._createId("SectionSubty" + oSubtype.SubtypeId)
				});

				//Add the Section to the Object Page Layout
				oObjectPageLayout.addSection(oSection);
				oSection.data("Subtype", oSubtype.SubtypeId);

				//Select the first Section. Nothing is set by default which can lead to a problem when creating a new record without prior interaction.
				if (this._oGlobalInformationModel.getProperty("/selectedSubtype") === null) {
					if (i === 0) {
						this._oGlobalInformationModel.setProperty("/selectedSubtype", oSubtype.SubtypeId);
						this._oGlobalInformationModel.setProperty("/isSelectedSubtypeCreatable", this._getIsCreatableForSubtype(oSubtype.SubtypeId));

						oObjectPageLayout.setSelectedSection(oSection.getId());
					}
				} else {
					if (this._oGlobalInformationModel.getProperty("/selectedSubtype") === oSubtype.SubtypeId) {
						this._oGlobalInformationModel.setProperty("/isSelectedSubtypeCreatable", this._getIsCreatableForSubtype(oSubtype.SubtypeId));
					}
				}
			}.bind(this));
		},

		_refreshMainPage: function (bWithoutRead) {
			//destroy the content in all subsections...
			var oObjectPageLayout = sap.ui.getCore().byId(this._createId("displayObjectPageLayout"));
			oObjectPageLayout.destroySections();
			oObjectPageLayout.destroyHeaderContent();
			oObjectPageLayout.destroyHeaderTitle();
			if (this._oImageControl) {
				this._oImageControl.destroy();
				delete this._oImageControl;
			}

			if (this._oChangePictureAction) {
				this._oChangePictureAction.destroy();
				delete this._oChangePictureAction;
			}
			//... and rebuild the content 
			if (!bWithoutRead) {
				this._readData();
			}
			//	this._refreshMainPageHeader();
		},

		_selectSubtypeTab: function () {
			var sSelectedSubtypeId = this._oGlobalInformationModel.getProperty("/selectedSubtype"),
				oObjectPageLayout = sap.ui.getCore().byId(this._createId("displayObjectPageLayout")),
				oSection = sap.ui.getCore().byId(this._createId("SectionSubty" + sSelectedSubtypeId));
			oObjectPageLayout.setSelectedSection(oSection.getId());
		},

		_readCountryRecordsForIT0006: function (oXXRecordsData) {
			var aCountryReadPromises = [];
			var aCountryResults = [];

			//Loop over the XX records to find out which country specific calls are needed. 
			oXXRecordsData.results.forEach(function (oXXRecord) {
				var sVersionId;
				if (oXXRecord.VersionId) {
					sVersionId = oXXRecord.VersionId;
				} else {
					sVersionId = this._oGlobalInformationModel.getProperty("/defaultVersionId");
				}

				var entitySetName = this._getEntitySetNameForVersionId(sVersionId).entitySetName;
				var sObjectPath = this._oODataModel.createKey(entitySetName, oXXRecord);

				var oCountryReadPromise = new Promise(function (resolve, reject) {
					this._oODataModel.read("/" + sObjectPath, {
						urlParameters: {
							"$expand": "toFieldMetaData"
						},
						success: function (oCountryData) {
							aCountryResults.push(oCountryData);
							resolve();
						},
						error: function (oError) {
							reject(oError);
						},
						async: false
					});
				}.bind(this));

				aCountryReadPromises.push(oCountryReadPromise);

			}.bind(this));

			Promise.all(aCountryReadPromises).then(function () {
				oXXRecordsData.results.forEach(function (oXXRecord) {
					var oCountryRecord = this._findRecordInArray(aCountryResults, oXXRecord);
					this._addRecordToMainPage(oCountryRecord);
				}.bind(this));
				this._addPlaceholdersToEmptySubtypes();
				this._selectSubtypeTab();
			}.bind(this));
		},

		_buildExpandString: function (sVersionId, sEntitySetName, forDefault) {
			//Dynamically build an expand string containing the navigations for each entity
			//i.e. DE might have toFieldMetaData and toValueHelpCountry whereas
			//     US might have toFieldMetaData, toValueHelpCountry and toValueHelpRegion.

			var bFirstRound = true;
			var sExpandString;
			var sServiceName = this._oGlobalInformationModel.getProperty("/serviceName");
			var sEntityName;
			if (sVersionId) {
				sEntityName = this._getEntityNameForVersionId(sVersionId).entityName;
			}
			if (sEntitySetName) { //take that instead of the sVersionId
				sEntityName = sEntitySetName.substr(0, sEntitySetName.length - 3);
			}
			if (forDefault) {
				sEntityName = sEntityName + "Default";
			}
			var oEntityType = this._oODataModel.getMetaModel().getODataEntityType(sServiceName + "." + sEntityName);

			oEntityType.navigationProperty.forEach(function (oNavigation) {
				if (!bFirstRound) {
					sExpandString = sExpandString + ",";
				}
				if (!sExpandString || sExpandString.length === 0) {
					sExpandString = oNavigation.name;
				} else {
					sExpandString = sExpandString.toString() + oNavigation.name;
				}
				bFirstRound = false;
			});

			return sExpandString;

		},

		_findRecordInArray: function (aArray, oKey) {
			var aRecordsFound = aArray.filter(function (oRecord) {
				return oRecord.EmployeeNumber === oKey.EmployeeNumber &&
					oRecord.SubtypeId === oKey.SubtypeId &&
					oRecord.InfotypeId === oKey.InfotypeId &&
					oRecord.LockIndicator === oKey.LockIndicator &&
					oRecord.EndDate.getTime() === oKey.EndDate.getTime() &&
					oRecord.BeginDate.getTime() === oKey.BeginDate.getTime() &&
					oRecord.SequenceNumber === oKey.SequenceNumber &&
					oRecord.ObjectId === oKey.ObjectId &&
					oRecord.VersionId === oKey.VersionId;
			});
			if (aRecordsFound.length === 1) {
				return aRecordsFound[0];
			} else {
				return null;
			}
		},

		_cancelAndNavigateBack: function () {
			var oEditPage = sap.ui.getCore().byId(this._createId("editPage"));
			var sPath = oEditPage.getBindingContext().getPath();
			if (sPath.indexOf("/") === 0) {
				sPath = sPath.substring(1);
			}
			var oChangedData = this._oODataModel.getPendingChanges()[sPath];
			var bShowPopup = false;
			for (var property in oChangedData) {
				if (oChangedData.hasOwnProperty(property)) {
					if (property !== "BeginDate" && property !== "EndDate" && property !== "__metadata") {
						bShowPopup = true;
					}
				}
			}
			if (bShowPopup) {
				var sMessageText = this.getModel("libI18N").getProperty("persInfoChangesWillBeLost");
				MessageBox.confirm(
					sMessageText, {
						onClose: function (oAction) {
							if (oAction === sap.m.MessageBox.Action.OK) {
								this._leaveEditPage();
							} else {
								// Do Nothing
							}
						}.bind(this)
					});
			} else { //Don't show popup. Just leave. 
				this._leaveEditPage();
			}
		},

		_leaveEditPage: function () {
			this._oGlobalInformationModel.setProperty("/currentMode", "DISPLAY");
			this._setShowExceptionsOnly(false);
			this._oODataModel.resetChanges();
			var oNavContainer = this.getAggregation("_navContainer");
			oNavContainer.back();
			if (this._oGlobalInformationModel.getProperty("/refreshMainPage") === true) {
				this._refreshMainPage();
				this._oGlobalInformationModel.setProperty("/refreshMainPage", false);
			}
		},

		_addRecordToMainPage: function (oCountryRecord) {
			//Create the generic Wrapper Block
			var oSection = sap.ui.getCore().byId(this._createId("SectionSubty" + oCountryRecord.SubtypeId)),
				oSubSection = new ObjectPageSubSection(),
				oCountryWrapperBlock,
				oViewInitEvent = sap.uxap.BlockBase.getMetadata().getEvent("viewInit");

			if (oViewInitEvent) {
				oCountryWrapperBlock = new PersInfoDisplayWrapperBlock({
					mode: "Expanded",
					Edit: this.onEdit.bind(this),
					Delete: this.onDelete.bind(this),
					viewInit: this.onViewInit.bind(this),
					customData: [{
						key: "countryDisplayScreen",
						value: oCountryRecord.DisplayScreen
					}]
				});
			} else {
				oCountryWrapperBlock = new PersInfoDisplayWrapperBlock({
					mode: "Expanded",
					Edit: this.onEdit.bind(this),
					Delete: this.onDelete.bind(this)
				});
			}
			oSection.addSubSection(oSubSection);

			//bind the odata record to the block
			var entitySetName = this._getEntitySetNameForVersionId(oCountryRecord.VersionId).entitySetName,
				sCountryRecordObjectPath = this._oODataModel.createKey(entitySetName, oCountryRecord);

			oCountryWrapperBlock.bindElement("/" + sCountryRecordObjectPath);

			oSubSection.addBlock(oCountryWrapperBlock);

			//process the FieldMetaData
			var oFieldStatesModel = this._buildFieldStatesModel(oCountryRecord.toFieldMetaData.results, "DISPLAY").oFieldStatesModel;

			//Set the Edit and Delete Buttons per Record in a local model 
			var oRecordStateModel = new JSONModel({
				editVisible: oCountryRecord.IsEditable,
				editEnabled: this._getEntitySetNameForVersionId(oCountryRecord.VersionId).forceIntoDisplayMode ? false : oCountryRecord.IsEditable,
				deleteVisible: oCountryRecord.IsDeletable,
				deleteEnabled: this._getEntitySetNameForVersionId(oCountryRecord.VersionId).forceIntoDisplayMode ? false : oCountryRecord.IsDeletable,
				recordTitle: this._buildRecordTitle(oCountryRecord.BeginDate, oCountryRecord.EndDate),
				subtypeText: this._getSubtypeTextForSubtypeId(oCountryRecord.SubtypeId)
			});

			oCountryWrapperBlock.setModel(oFieldStatesModel, "FieldStates");
			oCountryWrapperBlock.setModel(oRecordStateModel, "RecordState");

			if (!oViewInitEvent) {
				var oContainer = sap.ui.getCore().byId(oCountryWrapperBlock.getSelectedView()).getContent()[0],
					oCountryView = this._getCountryView(oCountryRecord.DisplayScreen);

				oContainer.addItem(oCountryView);

				sap.ui.getCore().getEventBus().publish("hcm.fab.lib.common", "refreshFormGroupsVisibility");
			}
		},

		_publishValidityChangedEvent: function () {
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.publish("ValidityChanged");
		},

		_attachChangeEventToFields: function (oView) {
			var aControls = oView.getControlsByFieldGroupId("PersInfoValidation");
			aControls.forEach(function (oControl) {
				if (oControl.getMetadata().getEvent("liveChange")) {
					oControl.attachEvent("liveChange", this._doFieldValidationOnChange.bind(this));

				} else if (oControl.getMetadata().getEvent("change")) {
					oControl.attachEvent("change", this._doFieldValidationOnChange.bind(this));
				}
			}.bind(this));
		},

		_doFieldValidationOnChange: function (oEvent) {
			this._doFieldValidation(oEvent);
		},

		_doFieldValidation: function (oEvent) {
			var oCountryView = sap.ui.getCore().byId(this._createId("CountryView"));

			oCountryView.getController().validateField(oEvent.getSource(), oEvent);

		},

		_addPropertiesModelToCountryView: function (oView) {
			//whatever we add to the view here in this Properties model will be
			//available in the country- and commoncountry controller. This is needed because the views don't have
			//access to the main controller where we have the info already. 			
			oView.setModel(this._oCountryViewPropertiesModel, "Properties");
		},

		_getVersionIdFromEntity: function (sEntityName) {
			var sEntityName99 = this._getEntityNameForVersionId("99").entityName;
			var sEntityString;
			if (sEntityName.indexOf("Set") === -1) {
				sEntityString = sEntityName;
			} else {
				sEntityString = sEntityName.substring(0, sEntityName.length - 3);
			}

			if (sEntityString === sEntityName99) {
				return "99";
			} else {
				return sEntityString.substring(sEntityName99.length, sEntityString.length);
			}

		},

		_getVersionIdFromPath: function (sPath) {
			var oEntityNames = this._getEntityNamesFromPath(sPath);
			var sEntityName99 = this._getEntityNameForVersionId("99").entityName;
			var sEntitySetName = oEntityNames.entitySetName;
			var iEntitySetNameIndex;
			var sEndString;
			var iEndStringIndex;
			var iEntityName99Index;

			//This next statement came in due to the need to support countryspecific ITs that do not have a 99 entity. 
			//In this case the methode getEntityNameForVersionId returns the actual defaultVersionId instead of 99 when 
			//called with 99. The task is now to isolate the VersionId, return it and ignore the rest of the method. 
			//That logic is a bit too implicit and there is room for cleaning up and integrating this special case better.
			if (oEntityNames.entityName === sEntityName99) {

				var sLastTwoCharacters = sEntityName99.slice(-2);
				var regex = /\d{2}/;
				if (regex.test(sLastTwoCharacters)) {
					return sLastTwoCharacters;
				} else {
					return "99";
				}
			}

			iEntitySetNameIndex = sPath.indexOf(sEntitySetName);
			if (iEntitySetNameIndex === -1) {
				sEndString = "(";
			} else {
				sEndString = "Set(";
			}
			iEndStringIndex = sPath.indexOf(sEndString);
			iEntityName99Index = sPath.indexOf(sEntityName99);

			var iDifference = iEndStringIndex - (iEntityName99Index + sEntityName99.length);
			if (iDifference === 2) {
				return sPath.substring(iEntityName99Index + sEntityName99.length, iEntityName99Index + sEntityName99.length + 2);
			} else {
				return "99";
			}

		},

		_setShowExceptionsOnly: function (bShowExceptionsOnly) {
			try {
				this.getParent().getController().getOwnerComponent().setShowExceptionsOnly(bShowExceptionsOnly);
			} catch (err) {
				//probably the apps haven't implemented the note that introduces this function in component.js of the control
			}
		},

		_getCountryView: function (sScreenName) {
			// The sRetrievedPathFromControl contains the location for the country views as retrieved by the calling application
			// and defined in its main view. However we check whether we are running in an extension project and 
			// retrieve the actual path. If it differs from the passed path we first check the extension projects countryViews
			// folder to get the requested view. If it's not there we return to normal and check the passed location. Only
			// if it's not there either we return the error view. 

			var sComponentName = this.getParent().getController().getOwnerComponent().getMetadata().getComponentName();
			var sRetrievedPathFromControl = this.getProperty("countryViewsFolder");
			var sActualPathFromComponentName = sComponentName + ".countryViews";
			var sViewName;
			var oCountryView;

			if (sActualPathFromComponentName !== sRetrievedPathFromControl) {
				sViewName = sActualPathFromComponentName + "." + sScreenName;
				try {

					if (this._oGlobalInformationModel.getProperty("/currentMode") === "DISPLAY") {
						oCountryView = sap.ui.view({
							viewName: sViewName,
							controller: "",
							type: sap.ui.core.mvc.ViewType.XML
						});

					} else {
						oCountryView = sap.ui.view(this._createId("CountryView"), {
							viewName: sViewName,
							controller: "",
							type: sap.ui.core.mvc.ViewType.XML
						});
					}

					return oCountryView;

				} catch (err) {
					//Screen not found in Extension Project. No problem yet. Just proceed.
				}
			}

			sViewName = sRetrievedPathFromControl + "." + sScreenName;

			try {
				if (this._oGlobalInformationModel.getProperty("/currentMode") === "DISPLAY") {
					oCountryView = sap.ui.view({
						viewName: sViewName,
						controller: "",
						type: sap.ui.core.mvc.ViewType.XML
					});

				} else {
					oCountryView = sap.ui.view(this._createId("CountryView"), {
						viewName: sViewName,
						controller: "",
						type: sap.ui.core.mvc.ViewType.XML
					});

				}

				return oCountryView;

			} catch (err) {
				//Screen not found. Send back the error view
				var oErrorView = sap.ui.view({
					viewName: "hcm.fab.lib.common.view.PersInfoErrorView",
					controller: "",
					type: sap.ui.core.mvc.ViewType.XML
				});

				return oErrorView;
			}

		},

		_buildCreateScreen: function (sVersionId, sCountryId) {
			this._oEditPageMessageManager.removeAllMessages();

			var oViewInitEvent = sap.uxap.BlockBase.getMetadata().getEvent("viewInit"),
				oCountryWrapperBlock;
			if (oViewInitEvent) {
				oCountryWrapperBlock = new PersInfoEditWrapperBlock({
					mode: "Expanded",
					viewInit: this.onCreateViewInit.bind(this),
					customData: [{
						key: "versionId",
						value: sVersionId
					}, {
						key: "countryId",
						value: sCountryId
					}]
				});
			} else {
				oCountryWrapperBlock = new PersInfoEditWrapperBlock({
					mode: "Expanded"
				});
			}

			if (!oViewInitEvent) {
				var oContainer = sap.ui.getCore().byId(oCountryWrapperBlock.getSelectedView()).getContent()[0];
				this._handleOnCreate(sVersionId, sCountryId, oCountryWrapperBlock, oContainer);
			}
		},

		_handleOnCreate: function (sVersionId, sCountryId, oCountryWrapperBlock, oContainer) {

			var oEntityResult = this._getEntitySetNameForVersionId(sVersionId);
			if (oEntityResult.forceIntoDisplayMode) {
				MessageToast.show(this.getModel("libI18N").getProperty("persInfoCountryNotSupported"));
				return;
			}

			var oMainPage = sap.ui.getCore().byId(this._createId("mainPage")),
				oCreatePage = sap.ui.getCore().byId(this._createId("editPage"));
			oMainPage.setBusy(true);
			oCreatePage.setBusy(true);

			this._oGlobalInformationModel.setProperty("/currentMode", "CREATE");

			var sSelectedSubtype = this._oGlobalInformationModel.getProperty("/selectedSubtype");
			if (!sSelectedSubtype) {
				sSelectedSubtype = "";
			}

			var aFilters = [
				new Filter(
					"SubtypeId",
					sap.ui.model.FilterOperator.EQ,
					sSelectedSubtype
				),
				new Filter(
					"EmployeeNumber",
					sap.ui.model.FilterOperator.EQ,
					this._oGlobalInformationModel.getProperty("/employeeNumber")
				),
				new Filter(
					"VersionId",
					sap.ui.model.FilterOperator.EQ,
					sVersionId
				)
			];
			if (sCountryId) {
				aFilters.push(new Filter(
					"CountryId",
					sap.ui.model.FilterOperator.EQ,
					sCountryId
				));
			}

			var sExpandString = this._buildExpandString(sVersionId, null, true),
				sEntitySetNameForDefaults = oEntityResult.entitySetNameForDefaults,
				sEntitySetName = oEntityResult.entitySetName;

			this._destroyEditPage();

			this._oODataModel.read("/" + sEntitySetNameForDefaults, {
				filters: aFilters,
				async: false,
				urlParameters: {
					"$expand": sExpandString
				},
				success: function (oDefaultValuesRecords) {
					var oDefaultValues = oDefaultValuesRecords.results[0],
						oFieldStateBuildResult = this._buildFieldStatesModel(oDefaultValues.toFieldMetaData.results, "CREATE");
					if (!oFieldStateBuildResult.sIsEditModeAvailable) {
						MessageToast.show(this.getModel("libI18N").getProperty("persInfoEmployeeLocked"));
						this._oGlobalInformationModel.setProperty("/currentMode", "DISPLAY"); //reset the mode to display
						oMainPage.setBusy(false);
						return;
					}

					//create a new entry for the country entity, fill it with the default values and bind it to the block
					var oContext = this._oODataModel.createEntry(sEntitySetName, {
						properties: oDefaultValues
					});

					//fill some fields that haven't been filled properly by the defaultentity. 
					this._oODataModel.setProperty(oContext.getPath() + "/IsEditable", false);
					this._oODataModel.setProperty(oContext.getPath() + "/IsDeletable", false);

					this._addEditPageHeader("CREATE");
					this._attachValueHelpsToEditPage(null, oDefaultValues, sVersionId);

					var oCountryView = this._getCountryView(oDefaultValues.EditScreen),
						oEditObjectPageLayout = sap.ui.getCore().byId(this._createId("editObjectPageLayout")),
						oSection = new ObjectPageSection(),
						oSubSection = new ObjectPageSubSection(),
						sPath = oContext.getPath(),
						oBeginDate = this._oODataModel.getProperty(sPath + "/BeginDate"),
						oEndDate = this._oODataModel.getProperty(sPath + "/EndDate"),
						//The sVersionId the method was called with is not necessarily the one we use to proceed due to some Fallback logic
						//and the EntityMap. The EntityName knows the truth. 
						sVersionIdUsed = this._getVersionIdFromEntity(sEntitySetName);

					oSubSection.addBlock(oCountryWrapperBlock);
					oSection.addSubSection(oSubSection);
					oEditObjectPageLayout.addSection(oSection);

					this._fillCountryViewPropertiesModel(oCountryView, sVersionIdUsed, oBeginDate, oEndDate, "CREATE");

					this._attachChangeEventToFields(oCountryView);

					//build Validity Fields Properties
					this._fillValidityFieldsPropertiesModel(oDefaultValues.toValidityInfo.results, sPath);

					//set subtype information
					this._oEditPagePropertiesModel.setProperty("/selectedSubtype", sSelectedSubtype);
					this._oEditPagePropertiesModel.setProperty("/selectedSubtypeText", this._getSubtypeTextForSubtypeId(sSelectedSubtype));

					//make decisions whether or not to show the countryselector and subtypeselector 
					if (this._oGlobalInformationModel.getProperty("/infotype") === "0006" ||
						this._oGlobalInformationModel.getProperty("/numberOfSubtypes") > 1) {

						var oCountrySelectorFragment = sap.ui.xmlfragment(this.getId(),
							"hcm.fab.lib.common.view.fragment.PersInfoCountryAndSubtypeSelection", this);

						this._oEditPagePropertiesModel.setProperty("/subtypeSelectorVisible", this._oGlobalInformationModel.getProperty(
							"/numberOfSubtypes") > 1);

						this._oEditPagePropertiesModel.setProperty("/countrySelectorVisible", this._oGlobalInformationModel.getProperty("/infotype") ===
							"0006");

						oContainer.addItem(oCountrySelectorFragment);
					}

					oContainer.addItem(oCountryView);

					this._addValidityFragment(oContainer, true);

					if (this._oGlobalInformationModel.getProperty("/infotype") === "0006" && oDefaultValues.CountryId !== "99" && oDefaultValues
						.CountryId !==
						undefined) {
						this._oEditPagePropertiesModel.setProperty("/selectedAddressCountryId", oDefaultValues.CountryId);
					}
					if ((this._getEntityNamesFromPath(sPath).entityName === "AddressUN") && (this._oEditPagePropertiesModel.getProperty(
							"/selectedAddressCountryId") === "")) {
						this._oEditPagePropertiesModel.setProperty("/selectedAddressCountryId", "UN");
					}

					oCreatePage.setModel(oFieldStateBuildResult.oFieldStatesModel, "FieldStates");
					oCreatePage.bindElement(sPath);

					sap.ui.getCore().getEventBus().publish("hcm.fab.lib.common", "refreshFormGroupsVisibility");

					oCreatePage.setBusy(false);

					var oNavContainer = this.getAggregation("_navContainer");
					oNavContainer.to(this._createId("editPage"), "slide");

					oMainPage.setBusy(false);

					this._setShowExceptionsOnly(true);
				}.bind(this),

				error: function () {
					oMainPage.setBusy(false);
				}.bind(this)
			});

		},

		_fillValidityFieldsPropertiesModel: function (aValidityInfo, sPath) {
			var aValidityTypes = this._convertValidityInfo(aValidityInfo);
			this._oEditPagePropertiesModel.setProperty("/validityTypes", aValidityTypes);
			this._oEditPagePropertiesModel.setProperty("/validityTypeVisible", aValidityTypes.length > 1);

			var sValidityType = this._determineInitialValidityTypeForPreSelection(aValidityTypes);
			this._updateValidityFieldsModel(sValidityType);

			if (aValidityTypes.length === 1 && sValidityType === "TODAY") {
				this._oEditPagePropertiesModel.setProperty("/validityFormVisible", false);
			}

			if (sValidityType !== "EMPTY") {
				//Change the begin and end date of the record to be created according to the default dates provided by the customizing. 
				var oDefaultDates = this._getDefaultDatesForValidityType(sValidityType);
				this._oODataModel.setProperty(sPath + "/BeginDate", oDefaultDates.beginDate);
				this._oODataModel.setProperty(sPath + "/EndDate", oDefaultDates.endDate);
			}
		},

		_fillCountryViewPropertiesModel: function (oView, sVersionId, oBeginDate, oEndDate, sCurrentMode) {
			this._oCountryViewPropertiesModel.setProperty("/versionId", sVersionId);
			this._oCountryViewPropertiesModel.setProperty("/originalBeginDate", oBeginDate);
			this._oCountryViewPropertiesModel.setProperty("/originalEndDate", oEndDate);
			this._oCountryViewPropertiesModel.setProperty("/currentMode", sCurrentMode);

			this._addPropertiesModelToCountryView(oView);
		},

		_buildRecordTitle: function (dBeginDate, dEndDate) {
			var recordTitle;

			var oDateFormatterUTC = DateFormat.getDateInstance({
				style: Device.system.phone ? "short" : "medium",
				UTC: true
			});
			var utcBeginDate = oDateFormatterUTC.format(dBeginDate);
			var utcEndDate = oDateFormatterUTC.format(dEndDate);

			//dBeginDate is NOT today and dEndDate is NOT highdate
			if (!this._isToday(dBeginDate) && !this._isHighDate(dEndDate)) {
				//show "valid from <dBeginDate> to <dEndDate>"
				recordTitle = this.getModel("libI18N").getProperty("persInfoTitleValidFromDateToDate");
				recordTitle = recordTitle.replace("{0}", utcBeginDate);
				recordTitle = recordTitle.replace("{1}", utcEndDate);
			}

			//dBeginDate is today and dEndDate is NOT highdate
			if (this._isToday(dBeginDate) && !this._isHighDate(dEndDate)) {
				//show "valid from today to <dEndDate>"
				recordTitle = this.getModel("libI18N").getProperty("persInfoTitleValidFromTodayToDate");
				recordTitle = recordTitle.replace("{0}", utcEndDate);
			}

			//dBeginDate is NOT today and dEndDate is highdate
			if (!this._isToday(dBeginDate) && this._isHighDate(dEndDate)) {
				//show "valid from <dBeginDate>"
				recordTitle = this.getModel("libI18N").getProperty("persInfoTitleValidFromDate");
				recordTitle = recordTitle.replace("{0}", utcBeginDate);
			}

			//dBeginDate is today and dEndDate is highdate
			if (this._isToday(dBeginDate) && this._isHighDate(dEndDate)) {
				//show "valid from today"
				recordTitle = this.getModel("libI18N").getProperty("persInfoTitleValidFromToday");
			}

			return recordTitle;

		},

		_destroyEditPage: function () {
			var oEditObjectPageLayout = sap.ui.getCore().byId(this._createId("editObjectPageLayout"));
			oEditObjectPageLayout.destroySections();
			oEditObjectPageLayout.destroyHeaderTitle();
			oEditObjectPageLayout.destroyHeaderContent();
		},

		_getSubtypeTextForSubtypeId: function (sSubtypeId) {
			var aSubtypes = this._oEditPagePropertiesModel.getProperty("/subtypes");
			var aSubtypesFound = aSubtypes.filter(function (oSubtype) {
				return oSubtype.subtypeId === sSubtypeId;
			});
			if (aSubtypesFound.length !== 1) {
				this._showFatalError();
				return "";
			} else {
				return aSubtypesFound[0].subtypeText;
			}
		},

		_addEditPageHeader: function (sMode) {
			var sTitlePrefix;
			switch (sMode) {
			case "CREATE":
				sTitlePrefix = this.getModel("libI18N").getProperty("persInfoNewRecordHeader"); //DGATE 
				break;
			case "EDIT":
				sTitlePrefix = this.getModel("libI18N").getProperty("persInfoEditRecordHeader"); //DGATE 
				break;
			}

			var oObjectPageHeader = new ObjectPageHeader(this._createId("editPageOPH"), {
				objectTitle: sTitlePrefix.replace("&1", this._getSubtypeTextForSubtypeId(this._oGlobalInformationModel.getProperty(
					"/selectedSubtype")))
			});

			var oBreadCrumbLink = new sap.m.Link(this._createId("breadCrumbLinkToMainPage"), {
				text: this.getModel("i18n").getProperty("appTitle"),
				press: this.onBreadCrumbBackClick.bind(this)
			});
			oObjectPageHeader.addBreadCrumbLink(oBreadCrumbLink);

			var oEditObjectPageLayout = sap.ui.getCore().byId(this._createId("editObjectPageLayout"));
			oEditObjectPageLayout.setHeaderTitle(oObjectPageHeader);
		},

		_getEntityNamesFromPath: function (sPath) {
			var iIndexSet = sPath.indexOf("Set(");
			var sEntitySetName;
			var sEntityName;

			if (iIndexSet === -1) {
				sEntityName = sPath.substr(1, sPath.indexOf("(") - 1);
				sEntitySetName = sEntityName + "Set";
			} else {
				sEntitySetName = sPath.substr(1, sPath.indexOf("(") - 1);
				sEntityName = sEntitySetName.substr(0, sEntitySetName.length - 3);
			}
			return {
				entityName: sEntityName,
				entitySetName: sEntitySetName
			};
		},

		_showFatalError: function (sRefreshMainPage) {
			MessageBox.error(this.getModel("libI18N").getProperty("persInfoInternalError"), {
				onClose: function () {
					if (sRefreshMainPage) {
						this._refreshMainPage();
					}
				}.bind(this)
			});
		},

		_getContainerForCountryView: function (oEditObjectPageLayout) {
			var oSection = new ObjectPageSection(),
				oSubSection = new ObjectPageSubSection(),
				oCountryWrapperBlock = new PersInfoEditWrapperBlock({
					mode: "Expanded"
				});
			oSubSection.addBlock(oCountryWrapperBlock);
			oSection.addSubSection(oSubSection);
			oEditObjectPageLayout.addSection(oSection);

			var oContainer = sap.ui.getCore().byId(oCountryWrapperBlock.getSelectedView()).getContent()[0];

			return oContainer;
		},

		_getDefaultDatesForValidityType: function (sValidityType) {
			var aValidityTypes = this._oEditPagePropertiesModel.getProperty("/validityTypes");
			var oDefaultDates = {};

			aValidityTypes.forEach(function (oValidityType) {
				if (oValidityType.id === sValidityType) {
					oDefaultDates.beginDate = oValidityType.beginDate;
					oDefaultDates.endDate = oValidityType.endDate;
				}
			});
			return oDefaultDates;
		},

		_convertValidityInfo: function (aValidityInfo) {
			var aValidityTypes = [];
			aValidityInfo.forEach(function (oValidityInfoRecord) {
				var oValidityType = {};
				oValidityType.id = oValidityInfoRecord.ValidityType;
				switch (oValidityType.id) {
				case "FROM":
					oValidityType.text = this.getModel("libI18N").getProperty("persInfoValidityFromDate");
					break;
				case "TO":
					oValidityType.text = this.getModel("libI18N").getProperty("persInfoValidityToDate");
					break;
				case "FROM_TO":
					oValidityType.text = this.getModel("libI18N").getProperty("persInfoValidityFromDateToDate");
					break;
				case "TODAY":
					oValidityType.text = this.getModel("libI18N").getProperty("persInfoValidityFromToday");
					break;
				}

				oValidityType.beginDate = oValidityInfoRecord.ValidityBeginDate;
				oValidityType.endDate = oValidityInfoRecord.ValidityEndDate;
				oValidityType.isSelected = oValidityInfoRecord.OptionSelected;
				aValidityTypes.push(oValidityType);
			}.bind(this));
			return aValidityTypes;
		},

		_attachValueHelpsToEditPage: function (sPath, oDataRecord, useVersionId) {
			//The ValueHelps:
			//Get the navigations and create models from them for the ValueHelps.
			//A toValueHelpCountry nav will lead to a ValueHelpCountry Model attached to the EditPage and
			//therefore available in the country view for them to use.		

			var sVersionId = null;

			if (sPath) {
				//we are coming from the onEdit event. Use the VersionId from the Path
				sVersionId = this._getVersionIdFromPath(sPath);
			} else {
				//we are coming from the onCreate event that was started with a specific VersionId.This
				//was passed in useVersionId. Use it. 
				sVersionId = useVersionId;
			}

			var oEditPage = sap.ui.getCore().byId(this._createId("editPage"));
			var oMetaModel = this._oODataModel.getMetaModel();
			var sServiceName = this._oGlobalInformationModel.getProperty("/serviceName");
			var sEntityName = this._getEntityNameForVersionId(sVersionId).entityName;
			if (!sPath) { // we are coming from the CREATE not the Edit. 
				sEntityName = sEntityName + "Default";
			}
			var oEntityType = oMetaModel.getODataEntityType(sServiceName + "." + sEntityName);
			oEntityType.navigationProperty.forEach(function (oNavigation) {
				if (oNavigation.name.substring(0, 11) === "toValueHelp") {
					var oGenericValueHelp = new JSONModel();
					if (sPath) {
						var aValueHelpLines = [];
						this._oODataModel.getProperty(sPath + "/" + oNavigation.name).forEach(function (valueHelpLine) {
							var oValueHelpLine = this._oODataModel.getProperty("/" + valueHelpLine);
							aValueHelpLines.push(oValueHelpLine);
						}.bind(this));
						oGenericValueHelp.setSizeLimit(aValueHelpLines.length);
						oGenericValueHelp.setData(aValueHelpLines);
					} else {
						oGenericValueHelp.setSizeLimit(oDataRecord[oNavigation.name].results.length);
						oGenericValueHelp.setData(oDataRecord[oNavigation.name].results);
					}
					var sValueHelpName = oNavigation.name.slice(2);
					oEditPage.setModel(oGenericValueHelp, sValueHelpName);
				}
				//If the value help is the prominent Country Value Help for IT0006 we check all items inside the value help
				//for sanity. If any of those countries return a fallback scenario that will lead to a display only case 
				//it will be reflected as a disabled item in the dropdown. 				
				if (this._oGlobalInformationModel.getProperty("/infotype") === "0006" &&
					oNavigation.name === "toValueHelpCountry" &&
					this._oGlobalInformationModel.getProperty("/currentMode") === "CREATE") {

					var aValueHelpMyAddressesCountry = oDataRecord[oNavigation.name].results;
					if (!aValueHelpMyAddressesCountry[0].CountryId && !aValueHelpMyAddressesCountry[0].CountryText) {
						aValueHelpMyAddressesCountry.splice(0, 1); //If the first entry is the empty one introduced by the backend, remove it.
					}
					//Now remove a 99 entry that might have been introduced by internationalized countries 
					//Defaultvalue returned VersionId in CountryId in case of Create but only for countries that are 99`d in the feature. 
					//Normally it would contain DE not 01. 
					//Hence, the dropdown doesn't know what to do with it. This is a multistep workaround starting in onChangeMyAddressCountry
					//continues in buildCreateScreen and ends here
					var iIndex;
					aValueHelpMyAddressesCountry.forEach(function (oItem, index) {
						if (oItem.CountryId === "99") {
							iIndex = index;
						}
					});
					if (iIndex !== undefined) {
						aValueHelpMyAddressesCountry.splice(iIndex, 1);
					}

					//We don't allow UN to be chosen as a foreign address. Remove it from the drop down for all non-UN pernrs. 
					if (this._oGlobalInformationModel.getProperty("/defaultVersionId") !== "UN") {
						aValueHelpMyAddressesCountry.forEach(function (oItem, index) {
							if (oItem.CountryId === "UN") {
								iIndex = index;
							}
						});
						if (iIndex !== undefined) {
							aValueHelpMyAddressesCountry.splice(iIndex, 1);
						}
					}

					var oMyAddressesCountryValueHelp = new JSONModel();
					oMyAddressesCountryValueHelp.setSizeLimit(400);
					oMyAddressesCountryValueHelp.setData(aValueHelpMyAddressesCountry);
					oMyAddressesCountryValueHelp.getData().forEach(function (oCountryItem) {
						var bForceIntoDisplayMode = this._getEntityNameForVersionId(oCountryItem.VersionId).forceIntoDisplayMode;
						oCountryItem.Enabled = !bForceIntoDisplayMode;
					}.bind(this));
					oEditPage.setModel(oMyAddressesCountryValueHelp, "ValueHelpCountrySwitchMyAddresses");

				}

			}.bind(this));
		},

		_addValidityFragment: function (oContainer, bForEditMode) {
			if (bForEditMode) {
				var oValiditySelectorFragment = sap.ui.xmlfragment(this.getId(),
					"hcm.fab.lib.common.view.fragment.PersInfoValiditySelection", this);
				oContainer.addItem(oValiditySelectorFragment);

			} else {
				var oValidityDisplayFragment = sap.ui.xmlfragment(this.getId() + oContainer.getId(),
					"hcm.fab.lib.common.view.fragment.PersInfoValidityDisplay", this);
				oContainer.addItem(oValidityDisplayFragment);
			}
		},

		_isHighDate: function (date) {
			if (date.getUTCMonth() === 11 && date.getUTCFullYear() === 9999 && date.getUTCDate() === 31) {
				return true;
			} else {
				return false;
			}
		},

		_isToday: function (date) {
			var today = new Date();

			if (date.getUTCMonth() === today.getMonth() && date.getUTCFullYear() === today.getFullYear() && date.getUTCDate() === today.getDate()) {
				return true;
			} else {
				return false;
			}
		},

		_determineInitialValidityTypeForPreSelection: function (aValidityTypes) {
			var aTypes = aValidityTypes ? aValidityTypes : this._oEditPagePropertiesModel.getProperty("/validityTypes"),
				sSelectedType = "";

			if (aTypes.length === 0) {
				return "EMPTY";
			}

			aTypes.forEach(function (oValidityType) {
				if (oValidityType.isSelected) {
					sSelectedType = oValidityType.id;
				}
			});

			if (!sSelectedType) {
				sSelectedType = aTypes[0].id;
			}

			return sSelectedType;
		},

		_updateValidityFieldsModel: function (sValidityTypeSelection) {
			switch (sValidityTypeSelection) {
			case "TODAY":
				this._oEditPagePropertiesModel.setProperty("/validityBeginDateVisible", false);
				this._oEditPagePropertiesModel.setProperty("/validityEndDateVisible", false);
				this._oEditPagePropertiesModel.setProperty("/validityFormVisible", true);
				break;
			case "FROM":
				this._oEditPagePropertiesModel.setProperty("/validityBeginDateVisible", true);
				this._oEditPagePropertiesModel.setProperty("/validityEndDateVisible", false);
				this._oEditPagePropertiesModel.setProperty("/validityFormVisible", true);
				break;
			case "FROM_TO":
				this._oEditPagePropertiesModel.setProperty("/validityBeginDateVisible", true);
				this._oEditPagePropertiesModel.setProperty("/validityEndDateVisible", true);
				this._oEditPagePropertiesModel.setProperty("/validityFormVisible", true);
				break;
			case "TO":
				this._oEditPagePropertiesModel.setProperty("/validityBeginDateVisible", false);
				this._oEditPagePropertiesModel.setProperty("/validityEndDateVisible", true);
				this._oEditPagePropertiesModel.setProperty("/validityFormVisible", true);
				break;
			case "EMPTY":
				this._oEditPagePropertiesModel.setProperty("/validityBeginDateVisible", false);
				this._oEditPagePropertiesModel.setProperty("/validityEndDateVisible", false);
				this._oEditPagePropertiesModel.setProperty("/validityFormVisible", false);
				break;
			default:
				this._updateValidityFieldsModel("FROM_TO");
			}

			this._oEditPagePropertiesModel.setProperty("/validityTypeSelectedKey", sValidityTypeSelection);
		},

		_getSubtypeInfo: function (sSubtype) {
			var sPath = this._oODataModel.createKey("SubtypeAttributesSet", {
					InfotypeId: this._oGlobalInformationModel.getProperty("/infotype"),
					EmployeeNumber: this._oGlobalInformationModel.getProperty("/employeeNumber"),
					SubtypeId: sSubtype
				}),
				oSubtypeInfo = this._oODataModel.getProperty("/" + sPath);

			return oSubtypeInfo;
		},

		_getDefaultBegdaForSubtype: function (sSubtype) {
			return this._getSubtypeInfo(sSubtype).DefaultBegda;
		},

		_getIsCreatableForSubtype: function (sSubtype) {
			return this._getSubtypeInfo(sSubtype).IsCreatable;
		},

		_createPSKeyFilter: function (oRecord) {
			var aFilters = [
				new Filter(
					"EmployeeNumber",
					sap.ui.model.FilterOperator.EQ,
					oRecord.EmployeeNumber
				),
				new Filter(
					"InfotypeId",
					sap.ui.model.FilterOperator.EQ,
					oRecord.InfotypeId
				),
				new Filter(
					"SubtypeId",
					sap.ui.model.FilterOperator.EQ,
					oRecord.SubtypeId
				),
				new Filter(
					"LockIndicator",
					sap.ui.model.FilterOperator.EQ,
					oRecord.LockIndicator
				),
				new Filter(
					"ObjectId",
					sap.ui.model.FilterOperator.EQ,
					oRecord.ObjectId
				),
				new Filter(
					"EndDate",
					sap.ui.model.FilterOperator.EQ,
					oRecord.EndDate
				),
				new Filter(
					"BeginDate",
					sap.ui.model.FilterOperator.EQ,
					oRecord.BeginDate
				),
				new Filter(
					"SequenceNumber",
					sap.ui.model.FilterOperator.EQ,
					oRecord.SequenceNumber
				),
				new Filter(
					"VersionId",
					sap.ui.model.FilterOperator.EQ,
					oRecord.VersionId
				)
			];

			return aFilters;
		},

		_buildFieldStatesModel: function (aFieldMetaData, forMode) {
			var oResult = {
				oFieldStatesModel: new JSONModel(),
				sIsEditModeAvailable: false
			};

			aFieldMetaData.forEach(function (oFieldMetaDataLine) {
				//Add a node for the field if it's not there yet. i.e. "BEGDA"
				if (!oResult.oFieldStatesModel.getProperty("/" + oFieldMetaDataLine.FieldName)) {
					oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName, {});

					switch (forMode) {
					case "DISPLAY":
						oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName + "/Visible", oFieldMetaDataLine.IsVisible);
						oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName + "/Editable", false);
						oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName + "/Required", false);
						break;

					case "CREATE":
					case "EDIT":
						if (oFieldMetaDataLine.IsEditMode) {
							oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName + "/Visible", oFieldMetaDataLine.IsVisible);
							oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName + "/Editable", oFieldMetaDataLine.IsEditable);
							oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName + "/Required", oFieldMetaDataLine.IsRequired);
							oResult.sIsEditModeAvailable = true;
						} else {
							oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName + "/Visible", oFieldMetaDataLine.IsVisible);
							oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName + "/Editable", false);
							oResult.oFieldStatesModel.setProperty("/" + oFieldMetaDataLine.FieldName + "/Required", false);
						}
						break;
					}
				}
			});

			return oResult;
		},

		_addPlaceholdersToEmptySubtypes: function () {
			//Adding the placeholder block to all empty subsections.
			//A subsection needs to have content otherwise the title will not be displayed in the navigation tab
			//In our case: No infotyperecord for a subtype would mean no subtype in the header.
			//Hence, add the placeholder
			var aSections = sap.ui.getCore().byId(this._createId("displayObjectPageLayout")).getSections(),
				aSubSections = [];

			//Loop over all Sections...
			aSections.forEach(function (oSection) {
				//...and retrieve the Subsections
				aSubSections = oSection.getSubSections();
				//If there are no subsections there is no record for this subtype...
				if (aSubSections.length <= 0) {
					//...then add the placeholder
					var oSubSection = new ObjectPageSubSection(),
						oEmptyBlock = new PersInfoEmptyBlock();
					oEmptyBlock.attachEvent("Create", this.onCreate, this);
					oSubSection.addBlock(oEmptyBlock);
					oSubSection.addStyleClass("sapUxAPObjectPageSubSectionFitContainer");
					oSection.addSubSection(oSubSection);
				}
				oSection.connectToModels();
			}.bind(this));

			var oMainPage = sap.ui.getCore().byId(this._createId("mainPage"));
			oMainPage.setBusy(false);
		},

		_getTheRightCountryView: function () {
			/*			How this works:
						0. Check which Infotype you are
							a) if IT0006, get the xx records, loop over them and read the VersionId for each record
								aa) if empty then proceed to 1
								ab) if filled then proceed to 2
							b) if not IT0006 then 1
						1. get the DefaultVersionId kept in the GlobalInformationModel
						2. Check the Entity Map (JSON Model File) and retrieve the Entity for the given DefaultVersionId
							a) if not available, Check the Entity Map (JSON Model File) and retrieve the Entity for the given MappedVersionId (if available)
								aa) if not available, get the entity for 99 from the file and proceed with display only in mind to 3
								bb) if available then 3.
							b) if available then 3.
						3. Check if the Entity is available in the Service Metadata
							a) if not available use the entity for 99. 
								aa) if 99 available proceed to 4 in display mode
								ab) if 99 not available, dump
							b) if available then 4
						----------------
						4. Read the country records with the given Entity 
						5. Read the screenName from the country records
						6. Instantiate the View 
							a) if not available, instantiate the view for 99
								aa) if 99 available proceed to 7 in display mode
								ab) if 99 not available, dump
							b) if available then 7
						7. done*/

		},

		_createCountryBlock: function (sBlockName, sViewName) {
			if (!this._oBlockList[sBlockName]) {
				this._oBlockList[sBlockName] = BlockBase.extend("hcm.fab.lib.common.block." + sBlockName, {
					metadata: {
						views: {
							Collapsed: {
								viewName: sViewName,
								type: "XML"
							},
							Expanded: {
								viewName: sViewName,
								type: "XML"
							}
						},
						events: {}
					}
				});
			}
			return new this._oBlockList[sBlockName]();
		},

		_createId: function (sId) {
			return this.getId() + "--" + sId;
		},

		_getEntitySetNameForVersionId: function (sVersionId) {
			var oResult = this._getEntityNameForVersionId(sVersionId);
			if (!oResult) {
				return null;
			} else {
				return {
					entitySetName: oResult.entityName + "Set",
					entitySetNameForDefaults: oResult.entityNameForDefaults + "Set",
					forceIntoDisplayMode: oResult.forceIntoDisplayMode,
					entityVersionId: oResult.entityVersionId
				};
			}
		},

		_getEntityNameForVersionId: function (sVersionId) {
			var oResult = {},
				sDefaultVersionId = sVersionId;
			if (!sDefaultVersionId) {
				sDefaultVersionId = this._oGlobalInformationModel.getProperty("/defaultVersionId");
			}

			//For the given VersionId see if the app has implemented a controller hook that defines the entityName
			//If yes, then proceed with this EntityName. However, do not check for 99. You are not allowed to change
			//the EntityName for 99 for safety reasons and prevent potential issues (Perhaps there are none). If at 
			//a later state we decide to also allow the changing of 99 we have to check again at the end of the function
			//after all the fallback logic below.

			//we don't see any argument against allowing the customer to change the entityname for 99, too.
			//it's under his responsibility to guarantee the correct processing of the record

			//if (sDefaultVersionId !== "99") {
			try {
				var sCustomEntityName = this.getParent().getController().getCustomEntityNameForVersionId(sDefaultVersionId);
				//check whether we are dealing with IT0006 and an employee assigned to MOLGA 'UN'
				var bIsIT0006ForUN = (this._oGlobalInformationModel.getProperty("/infotype") === "0006" && this._oGlobalInformationModel.getProperty(
					"/defaultVersionId") === "UN");
				//special logic for IT0006 and UN employees: always use AddressUN/AddressUNDefault to be able to  
				//display and update secondary infotype 3399
				if (!(sCustomEntityName) && bIsIT0006ForUN) {
					sCustomEntityName = "AddressUN";
				}
				if (sCustomEntityName) {
					oResult = {
						entityName: sCustomEntityName,
						entityNameForDefaults: sCustomEntityName + "Default",
						forceIntoDisplayMode: false,
						entityVersionId: sDefaultVersionId
					};

					return oResult;
				}
			} catch (err) {
				//app does not have the function. proceed. 
			}
			//}

			var aEntityMap = this._oEntityMap.getData().EntityMap;

			//Read the VersionId from the calling app's config JSON file EntityMap
			var aEntriesFound = aEntityMap.filter(function (oEntry) {
					return oEntry.VersionId === sDefaultVersionId;
				}),
				//Also always read the Entry from the file for versionid 99
				aEntriesFoundFor99 = aEntityMap.filter(function (oEntry) {
					return oEntry.VersionId === "99";
				});

			var bForceIntoDisplayMode = false,
				sEntityVersionId = "";

			if (aEntriesFound.length !== 0) {
				sEntityVersionId = sDefaultVersionId;

			} else {
				//If we haven't found an entry for the defaultVersionId...
				//...we try to find an entry for the mappedVersionId
				aEntriesFound = [];
				var sMappedVersionId = this._oGlobalInformationModel.getProperty("/mappedVersionId");
				if (sMappedVersionId) {
					aEntriesFound = aEntityMap.filter(function (oEntry) {
						return oEntry.VersionId === sMappedVersionId;
					});
				}

				if (aEntriesFound.length !== 0) {
					sEntityVersionId = sMappedVersionId;

				} else {
					//if there is also no entry for the mappedVersionId or no mappedVersionId exists...
					//...we get the entry for 99, if there is one. (should always be the case)
					if (aEntriesFoundFor99.length !== 0) {
						sEntityVersionId = "99";
						bForceIntoDisplayMode = true;
					} else {
						//no international entity available. dump.
						//popup and return
					}
				}
			}

			if (sEntityVersionId) {
				var sEntityName = sEntityVersionId !== "99" ? aEntriesFound[0].Entity : aEntriesFoundFor99[0].Entity;

				//for the found entries...
				//...we check if it's implemented in the odatamodel
				if (!this._isEntityImplemented(sEntityName)) {
					//If it's not implemented we check if we have found a 99 entry in the file
					if (aEntriesFoundFor99.length !== 0) {
						sEntityVersionId = "99";
						sEntityName = aEntriesFoundFor99[0].Entity;
						bForceIntoDisplayMode = true;
						//check if the entity for 99 is implemented in the odatamodel (should always be the case)
						if (!this._isEntityImplemented(sEntityName)) {
							//no 99 entity available. problem.
							//popup and return. 
						}
					} else {
						//no international entity available. dump.
						//popup and return
					}
				}

				//Temporary Coding (will be adapted once apps are finished with all country versions):
				//All IT0006 countries are delivered (except Russia). For all unknown countries allow editing via 99
				//All the other ITs will still be display-only for 99
				if (this._oGlobalInformationModel.getProperty("/infotype") === "0006" && sEntityVersionId === "99") {
					bForceIntoDisplayMode = false;
				}
				//Infotype 105 only has an international screen. It's okay to enable editing for all countries
				if (this._oGlobalInformationModel.getProperty("/infotype") === "0105" && sEntityVersionId === "99") {
					bForceIntoDisplayMode = false;
				}
				//Infotype 32 only has an international screen. It's okay to enable editing for all countries
				if (this._oGlobalInformationModel.getProperty("/infotype") === "0032" && sEntityVersionId === "99") {
					bForceIntoDisplayMode = false;
				}
				//Infotype 21 only has an international screen. It's okay to enable editing for all countries
				if (this._oGlobalInformationModel.getProperty("/infotype") === "0021" && sEntityVersionId === "99") {
					bForceIntoDisplayMode = false;
				}
				//Infotype 2 only has an international screen. It's okay to enable editing for all countries
				if (this._oGlobalInformationModel.getProperty("/infotype") === "0002" && sEntityVersionId === "99") {
					bForceIntoDisplayMode = false;
				}
				//Infotype 9 only has an international screen. It's okay to enable editing for all countries
				if (this._oGlobalInformationModel.getProperty("/infotype") === "0009" && sEntityVersionId === "99") {
					bForceIntoDisplayMode = false;
				}
				//End of Temporary Coding

				oResult = {
					entityName: sEntityName,
					entityNameForDefaults: sEntityName + "Default",
					forceIntoDisplayMode: bForceIntoDisplayMode,
					entityVersionId: sEntityVersionId
				};
				return oResult;
			} else {
				return null;
			}
		},

		_isEntityImplemented: function (sEntityName) {
			//This function checks whether we have an Entity available in the Odataservice that matches the country
			var sServiceName = this._oGlobalInformationModel.getProperty("/serviceName"),
				oEntityType = this._oODataModel.getMetaModel().getODataEntityType(sServiceName + "." + sEntityName);
			return !!(oEntityType);
		},

		_getSubtypeFormatted: function (sSubtype) {
			//turn the Subtype number into a four digit number with leading zeros
			var len = sSubtype.length;
			return ("0000" + sSubtype).substring(len - 1, len + 3);
		},

		/**
		 * This method can be called to determine whether the sapUiSizeCompact or sapUiSizeCozy
		 * design mode class should be set, which influences the size appearance of some controls.
		 * @public
		 * @return {string} css class, either 'sapUiSizeCompact' or 'sapUiSizeCozy' - or an empty string if no css class should be set
		 */
		_getContentDensityClass: function () {
			if (this._sContentDensityClass === undefined) {
				// check whether FLP has already set the content density class; do nothing in this case
				if (jQuery(document.body).hasClass("sapUiSizeCozy") || jQuery(document.body).hasClass("sapUiSizeCompact")) {
					this._sContentDensityClass = "";
				} else if (!Device.support.touch) { // apply "compact" mode if touch is not supported
					this._sContentDensityClass = "sapUiSizeCompact";
				} else {
					// "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
					this._sContentDensityClass = "sapUiSizeCozy";
				}
			}
			return this._sContentDensityClass;
		},

		_createManagerQuickView: function () {
			var oView = sap.ui.getCore().byId(this._createId("mainPage"));
			this._oManagerQuickView = sap.ui.xmlfragment("hcm.fab.lib.common.view.fragment.PersInfoManagerQuickview", this);
			jQuery.sap.syncStyleClass(this._getContentDensityClass(), oView, this._oManagerQuickView);
			oView.addDependent(this._oManagerQuickView);
		},

		_createOfficeInfoQuickView: function () {
			var oView = sap.ui.getCore().byId(this._createId("mainPage"));
			this._oOfficeInfoQuickView = sap.ui.xmlfragment("hcm.fab.lib.common.view.fragment.PersInfoOfficeInfoQuickview", this);
			jQuery.sap.syncStyleClass(this._getContentDensityClass(), oView, this._oOfficeInfoQuickView);
			oView.addDependent(this._oOfficeInfoQuickView);
		},

		_initCrossAppNavigationSettings: function (oCrossAppNavigator) {
			// only display Employee Lookup action button if the app is acually available
			var aCrossAppNavIntend = [{
				target: {
					semanticObject: "Employee",
					action: "lookup"
				}
			}];

			oCrossAppNavigator.isNavigationSupported(aCrossAppNavIntend)
				.done(function (aResponses) {
					// set action button visibility accordingly
					this._oGlobalInformationModel.setProperty("/isEmplLookupAvailable", aResponses[0].supported);
				}.bind(this))
				.fail(function () {
					// hide action button 
					this._oGlobalInformationModel.setProperty("/isEmplLookupAvailable", false);
				}.bind(this));
		},

		_crossAppResolver: function (sManagerId, isEmplLookupAvailable) {
			if (sManagerId && isEmplLookupAvailable) {
				var oNavConfig = {
					target: {
						semanticObject: "Employee",
						action: "lookup"
					},
					params: {
						"EmployeeNumber": sManagerId
					}
				};
				return function () {
					return oNavConfig;
				};
			}
			return null;
		},

		formatEmployeeImageURL: function (oEmployee, bIsEmployeePictureVisible, oPhotoDate) {
			if (oEmployee && bIsEmployeePictureVisible) {
				var sTimeParameter = oPhotoDate ? "?photoDate=" + oPhotoDate.getTime() : "",
					fnEncodeApostrophe = function (sString) {
						// encode apostrophes with "%27"
						return sString.replace(new RegExp("'", "g"), "%27");
					};
				// previous service versions implemented ToEmployeePicture wrong, so do not use it
				if (!this._bUseToPictureNavigation) {
					var sServiceUrl = CommonModelManager.getServiceUrl();
					return fnEncodeApostrophe(sServiceUrl + CommonModelManager.getModel().createKey("EmployeePictureSet", {
						EmployeeId: oEmployee.EmployeeNumber,
						ApplicationId: oEmployee.ApplicationId
					}) + "/$value" + sTimeParameter);
				} else {
					var oModel = CommonModelManager.getModel();
					var sNavPropertyPath = oModel.createKey("EmployeeDetailSet", oEmployee) + "/ToEmployeePicture";
					var oPictureSet = oModel.getProperty("/" + sNavPropertyPath);
					if (oPictureSet) {
						// Make picture url relative
						var sPictureUrl = oPictureSet.__metadata.media_src.replace(/(\w+\:\/\/)?[^\/]+/, "");
						return sPictureUrl;
					} else {
						return "";
					}
				}
			} else {
				return "";
			}
		},

		formatManagerLink: function (sManagerId) {
			if (sManagerId) {
				this.oCrossAppNav = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService("CrossApplicationNavigation");
				var oNavConfig = (this.oCrossAppNav && this.oCrossAppNav.hrefForExternal({
					target: {
						semanticObject: "Employee",
						action: "lookup"
					},
					params: {
						"EmployeeNumber": sManagerId
					}
				})) || "";
				return oNavConfig;
			}
			return null;
		},

		formatOfficeLocation: function (building, room) {
			if (building && room) {
				return building + ", " + room;
			} else if (building && !room) {
				return building;
			} else if (!building && room) {
				return room;
			} else {
				return null;
			}
		},

		formatObjectTitle: function (sName, sEmployeeID, bIsEmployeeNumberVisible, bShowEmployeeNumberWithoutZeros) {
			if (Device.system.desktop && sEmployeeID && bIsEmployeeNumberVisible) {
				var employeeId = bShowEmployeeNumberWithoutZeros ? parseInt(sEmployeeID, 10) : sEmployeeID;
				return sName + " (" + employeeId + ")";
			}
			return sName;
		},

		formatObjectTextWithBrackets: function (sText, sTextInBrackets) {
			if (sTextInBrackets) {
				return sText + " (" + sTextInBrackets + ")";
			}
			return sText;
		}

	});

	return PersInfoControl;
});
