/*
 * File : CSWClient.js
 * Author : Rob van Swol
 * Organisation: National Aerospace Laboratory NLR
 * Country : The Netherlands
 * email : vanswol@nlr.nl
 * Description: Simple AJAX based CSW client 
 * Tested on : FireFox 3, Safari, IE 7
 * Last Change : 2008-10-22
 */
var CSWClient = function () {
    var USE_PROXY = true,
			NAMESPACES = {
		'dc': 'http://purl.org/dc/elements/1.1/',
		'dct': 'http://purl.org/dc/terms/',
		'gco': 'http://www.isotc211.org/2005/gco',
		'gmd': 'http://www.isotc211.org/2005/gmd',
		'ows': 'http://www.opengis.net/ows',
		'cat': 'http://www.esri.com/metadata/csw/',
		'csw': 'http://www.opengis.net/cat/csw/2.0.2'
	},
	_context,
			proxy,
			getrecords_xsl,
			getrecordbyid_xsl,
			defaults_xml,
			cswhost,
			defaultschema,
			_currentSBFeatureSearch = '',
			_sbConstraintFeature = false,
			_sbConstraintCoverage = false,
			_capabilitiesMap = {},
			_DATASET_SELECTED_TITLE = '#dataset-selected-title',
			_DATASET_URL_INPUT_BOX = '#dataset-url-input-box';
 
    function handleCSWResponse(request, xml) {

        var stylesheet = "js/excat/xsl/prettyxml.xsl";
        if (request === "getrecords" & document.theForm.displaymode.value !== "xml") {
            stylesheet = "js/excat/xsl/csw-results.xsl";
        } else if (request === "getrecordbyid" & document.theForm.displaymode.value !== "xml") {
            stylesheet = "js/excat/xsl/csw-metadata.xsl";
        }

        var xslt = loadDocument(stylesheet);
        var processor = new XSLTProcessor();
        processor.importStylesheet(xslt);

        var XmlDom = processor.transformToDocument(xml);
        var serializer = new XMLSerializer();
        var output = serializer.serializeToString(XmlDom.documentElement);

        var outputDiv = document.getElementById("csw-output");
        if (request === "getrecordbyid") {
			outputDiv = document.getElementById("metadata");
		}
        outputDiv.innerHTML = replaceURLWithHTMLLinks(output);
        $(outputDiv).dialog({
            'modal' : true,
            width : '90%',
            height : request === "getrecordbyid" ? $(window).height() / 1.25 : 'auto',
            resizable : true,
            draggable: true,
            'title' : request === "getrecordbyid" ? 'Dataset metadata' : 'Choose a data set',
            zIndex: 9999
        });

		// If a user has previously viewed metadata and has scrolled down,
		// the new window opens up scrolled down to the location they were 
		// at previously. This fixes that issue.
        $(outputDiv).scrollTop(0);

        // Some hackery needs to happen here because IE8 will have window.onunload triggered 
        // when selecting a dataset even though it just calls javascript and doesn't try to leave the
        // page
        // http://stackoverflow.com/a/7651818
        $(window).data('beforeunload', window.onbeforeunload);
        $('a[href^="javascript:"]').hover(
            function () {
                window.onbeforeunload = null;
            },
            function () {
                window.onbeforeunload = $(window).data('beforeunload');
		});
    }

    // http://stackoverflow.com/questions/37684/how-to-replace-plain-urls-with-links
    function replaceURLWithHTMLLinks(text) {
        var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        if (text && !text.toLowerCase().contains('noreplace')) {
            return text.replace(exp, "<a href='$1' target='_blank'>$1</a>");
        } else {
            return text;
        }
    }


    function getRecordById(id) {

        var schema = defaultschema;
        if (document.theForm.schema !== null) {
            schema = document.theForm.schema.value;
        }

        setXpathValue(defaults_xml, "/defaults/outputschema", schema + "");
        setXpathValue(defaults_xml, "/defaults/id", id + "");

        var processor = new XSLTProcessor();
        processor.importStylesheet(getrecordbyid_xsl);

        var request_xml = processor.transformToDocument(defaults_xml);
        var request = new XMLSerializer().serializeToString(request_xml);

        return sendCSWRequest(request);
    }

    function sendCSWRequest(request)	{

        var xml = Sarissa.getDomDocument();
        xml.async = false;
        var xmlhttp = new XMLHttpRequest();

        var params = request;
        var cswProxy = proxy + cswhost;
        if (USE_PROXY) {
            xmlhttp.open("POST", cswProxy, false);
        }
        else {
            xmlhttp.open("POST", cswhost, false);
        }
        xmlhttp.setRequestHeader("Content-type", "application/xml");
        xmlhttp.setRequestHeader("Content-length", params.length);
        xmlhttp.setRequestHeader("Connection", "close");
        xmlhttp.send(params); // POST

        xml = xmlhttp.responseXML;
        return xml;
    }

    function loadDocument(uri) {

        var xml = Sarissa.getDomDocument();
        var xmlhttp = new XMLHttpRequest();
        xml.async = false;
        xmlhttp.open("GET", uri, false);
        xmlhttp.send('');
        xml = xmlhttp.responseXML;
        return xml;
    }

    function setXpathValue(_a,_b,_c) {

        var _e=_a.selectSingleNode(_b);
        if(_e){
            if(_e.firstChild){
                _e.firstChild.nodeValue=_c;
            }else{
                dom=Sarissa.getDomDocument();
                v=dom.createTextNode(_c);
                _e.appendChild(v);
            }
            return true;
        }else{
            return false;
        }
    }

    function writeClient(divId) {
        var client_xml = loadDocument("js/excat/xml/cswclient.xml");
        /* if no default cswhost has been defined we provide the user with optional csw hosts */
        if (cswhost === null) {
            var cswhosts_xml = loadDocument("js/excat/xml/csw-hosts.xml");
            var span = client_xml.selectSingleNode("//span[@id='csw-hosts']");
            importNode = client_xml.importNode(cswhosts_xml.documentElement, true);
            span.appendChild(importNode);
        }
        var serializer = new XMLSerializer();
        var output = serializer.serializeToString(client_xml);
        var div = document.getElementById(divId);
        div.innerHTML = output;
    }

    function clearPage() {
        document.theForm.query.value = "";
        var outputDiv = document.getElementById("csw-output");
        outputDiv.innerHTML = "";
        hideDiv(document.getElementById('popup'));
    }

    function overlayDiv(div) {
        while (div.tagName !== "DIV") {
            div = div.parentNode;
        }

        _width = div.offsetWidth;
        _height = div.offsetHeight;
        _top = findPosY(div);
        _left = findPosX(div);

        //overlay = document.createElement("div")
        //overlay.setAttribute("id", "overlay")
        var overlay = document.getElementById('overlay');
        overlay.style.width = _width + "px";
        overlay.style.height = _height + "px";
        overlay.style.position = "absolute";
        overlay.style.background = "#555555";
        overlay.style.top = _top + "px";
        overlay.style.left = _left + "px";

        overlay.style.filter = "alpha(opacity=70)";
        overlay.style.opacity = "0.7";
        overlay.style.mozOpacity = "0.7";
        overlay.style.visibility="visible";

        document.getElementsByTagName("body")[0].appendChild(overlay);
    }

    function removeDiv(div)	{
        document.getElementsByTagName("body")[0].removeChild(div);
    }



    function showDiv(div) {
        //this.overlayDiv(document.getElementById('results-container'));
        overlayDiv(document.getElementById('cswclient'));
        div.style.visibility="visible";
    }

    function positionDiv(div1, div2) {
        var width = div2.offsetWidth - 100;
        var height = div2.offsetHeight - 100;
        var top = findPosY(div2) + 50;
        var left = findPosX(div2) + 50;
        div1.style.width = width + "px";
        div1.style.position = "absolute";
        div1.style.background = "#ffffff";
        div1.style.top = top + "px";
        div1.style.left = left + "px";
    }

    function positionPopUp(div1, div2) {
        var top = findPosY(div2)+50+getScrollY();
        div1.style.top = top + "px";
    }

    function findPosX(obj) {
        var curleft = 0;
        if(obj.offsetParent)
            while(1) {
                curleft += obj.offsetLeft;
                if(!obj.offsetParent)
                    break;
                obj = obj.offsetParent;
            }
        else if(obj.x)
            curleft += obj.x;
        return curleft;
    }

    function findPosY(obj) {
        var curtop = 0;
        if(obj.offsetParent)
            while(1) {
                curtop += obj.offsetTop;
                if(!obj.offsetParent)
                    break;
                obj = obj.offsetParent;
            }
        else if(obj.y)
            curtop += obj.y;
        return curtop;
    }

    function getScrollY() {
        var scrollY = 0;
        if (typeof window.pageYOffset === "number") scrollY = window.pageYOffset;
        else if (document.documentElement && document.documentElement.scrollTop)
            scrollY = document.documentElement.scrollTop;
        else if (document.body && document.body.scrollTop)
            scrollY = document.body.scrollTop;
        else if (window.scrollY) scrollY = window.scrollY;
        return scrollY;
    }

    function trim(value) {
        value = value.replace(/^\s+/,'');
        value = value.replace(/\s+$/,'');
        return value;
    }

    function nsResolver(prefix) {
        return NAMESPACES[prefix] || null;
    }

    return {
        capabilitiesMap : _capabilitiesMap,
        currentSBFeatureSearch : _currentSBFeatureSearch,
        getContext : function() {
            return _context;
        },
        setContext : function(context) {
            _context = context;
        },
        init : function(_cswhost, host) {
            logger.info("GDP: Initializing CSW client.");
            if (typeof _cswhost !== "undefined") {
                cswhost = _cswhost;
            }
            else {
                cswhost = Constant.endpoint.csw;
            }

            if ($.browser.msie && $.browser.version === "9.0") {
                window.XMLSerializer = function(){};
                window.XMLSerializer.prototype.serializeToString = function(oNode){
                    return oNode.xml;
                };
            }

            proxy = Constant.endpoint.proxy;
            if (typeof host !== "undefined") {
                proxy = host + Constant.endpoint.proxy;
            }

            getrecords_xsl = loadDocument("js/excat/xsl/getrecords.xsl");
            getrecordbyid_xsl = loadDocument("js/excat/xsl/getrecordbyid.xsl");
            defaults_xml = loadDocument("js/excat/xml/defaults.xml");
            defaultschema = defaults_xml.selectSingleNode("/defaults/outputschema/text()").nodeValue;
            writeClient('csw-wrapper');
        },
        setCSWHost : function(host) {
            cswhost = host;
        },
        getCSWHost : function() {
            return cswhost;
        },
        setDatasetUrl : function(url) {
            if (url) {
                $(_DATASET_URL_INPUT_BOX).val(url);
                
                if ($('#metadata').length) {
                    $('#metadata').dialog('close');
                }
                if ($('#csw-output').length) {
                    $('#csw-output').dialog('close');    
                }
                
                $('#select-dataset-button').trigger('click');
            }
        },
        useProxy : function(tf) {
            USE_PROXY = tf;
        },
        hideDiv : function(div) {
            document.getElementById('overlay').style.visibility="hidden";
            div.style.visibility="hidden";
        },
        sendCSWGetCapabilitiesRequest : function(url, callback) {
            var cacheGetCaps = parseInt(Constant.config.csw.cache.getcaps);
            if (cacheGetCaps && _capabilitiesMap[url]) {
                logger.debug('GDP: CSW GetCapabilities from ' + url + ' found in cache. Using cached version.');
                callback(_capabilitiesMap[url]);
                return;
            }
            
            logger.debug('GDP: Sending CSW Get Capabilities request to: ' + url);
            $.ajax({
                url : (USE_PROXY) ? proxy + url : url,
                type : 'get',
                contentType : 'text/xml',
                data : {
                    'request' : 'GetCapabilities',
                    'service' : 'CSW',
                    'version' : '2.0.2'
                },
                
                success : function(data, textStatus, XMLHttpRequest) {
                    if (cacheGetCaps) {
                        logger.debug('GDP: CSW GetCapabilities from ' + url + ' received. Caching for later use.');
                        _capabilitiesMap[url] = data;
                    }
                    callback(data);
                }
            });
        },
        setSBConstraint : function(type) {
            if (type === "wfs") {
                _sbConstraintFeature = true;
                _sbConstraintCoverage = false;
            }
            else if (type === "wcs") {
                _sbConstraintFeature = false;
                _sbConstraintCoverage = true;
            }
            else {
                _sbConstraintFeature = false;
                _sbConstraintCoverage = false;
            }
        },
        getRecords : function(start) {
            // force outputSchema  always  to csw:Record for GetRecords requests xsl for 
            // this only handles dublin core, others are in GetRecordById xsl fixed this
            var results = "<results>";
            var schema = document.theForm.schema.value;            
            var sortby = document.theForm.sortby.value;
            var queryable = document.theForm.queryable.value;
            var operator = document.theForm.operator.value;
            var query = trim(document.theForm.query.value);
            var processor = new XSLTProcessor();
            
            if (typeof start === "undefined") {
                start = 1;
            }
            
            if (CSWClient.getCSWHost() === Constant.endpoint['sciencebase-csw']) {
                if (_context === 'wfs') {
                    CSWClient.setSBConstraint('wfs');
                } else {
                   CSWClient.setSBConstraint('wcs'); 
                }
            } else {
                CSWClient.setSBConstraint();
            }
            
            if (typeof document.theForm.cswhosts !== "undefined") {
                this.setCSWHost(document.theForm.cswhosts.value);
            }

            /*because geonetwork does not follow the specs*/
            if(cswhost.indexOf('geonetwork') !== -1 & queryable === "anytext") {
                queryable = "any";
            }

            if (operator === "contains" & query !== "") {
                query = "%" + query + "%";
            }

            setXpathValue(defaults_xml, "/defaults/outputschema", schema + '');
            setXpathValue(defaults_xml, "/defaults/propertyname", queryable + '');
            setXpathValue(defaults_xml, "/defaults/literal", query + '');
            
            // http://internal.cida.usgs.gov/jira/browse/GDP-507
            // If we're doing a ScienceBase search for Area of Interest, the search was throwing in some constrained bounding box.
            // Instead, we will not set the bounding box. The CSW Client will set -180, -90, 180, 90 as the bounding box.
            if (!(CSWClient.getCSWHost() === Constant.endpoint['sciencebase-csw']) && CSWClient.getSBConstraint !== 'wfs') {
                setXpathValue(defaults_xml, "/defaults/bboxlc", AOI.attributeBounds.lowerCorner + '');
                setXpathValue(defaults_xml, "/defaults/bboxuc", AOI.attributeBounds.upperCorner + '');
            }
            
            setXpathValue(defaults_xml, "/defaults/startposition", start + '');
            setXpathValue(defaults_xml, "/defaults/sortby", sortby + '');

            if (_sbConstraintFeature) {
                setXpathValue(defaults_xml, "/defaults/scienceBaseFeature", 'true');
                setXpathValue(defaults_xml, "/defaults/scienceBaseCoverage", 'false');
                results = "<results scienceBaseFeature=\"true\">";
            } else if (_sbConstraintCoverage) {
                setXpathValue(defaults_xml, "/defaults/scienceBaseCoverage", 'true');
                setXpathValue(defaults_xml, "/defaults/scienceBaseFeature", 'false');
                results = "<results scienceBaseCoverage=\"true\">";
            } else {
                setXpathValue(defaults_xml, "/defaults/scienceBaseCoverage", 'false');
                setXpathValue(defaults_xml, "/defaults/scienceBaseFeature", 'false');
            }      
            
            processor.importStylesheet(getrecords_xsl);

            var request_xml = processor.transformToDocument(defaults_xml);
            var request = new XMLSerializer().serializeToString(request_xml);
            var csw_response = sendCSWRequest(request);

            results += "<request start=\"" + start + "\"";
            results += " maxrecords=\"";
            results += defaults_xml.selectSingleNode("/defaults/maxrecords/text()").nodeValue;
            results += "\"/></results>";

            var results_xml;
            if (window.ActiveXObject) {
                // IE
                results_xml = new ActiveXObject('Msxml2.DOMDocument.6.0');
                results_xml.loadXML(results);
            } else {
                results_xml = (new DOMParser()).parseFromString(results, "text/xml");
            }

            var importNode = results_xml.importNode(csw_response.documentElement, true);
            results_xml.documentElement.appendChild(importNode);
            return handleCSWResponse("getrecords", results_xml);
        },
        
        displayMultipleOpenDAPSelection : function(id) {
            var csw_response = getRecordById(id);
            
            var stylesheet = "js/excat/xsl/multi-service-endpoint.xsl";

            var xslt = loadDocument(stylesheet);
            var processor = new XSLTProcessor();
            processor.importStylesheet(xslt);
            
            var XmlDom = processor.transformToDocument(csw_response);
            var serializer = new XMLSerializer();
            var output = serializer.serializeToString(XmlDom.documentElement);
            var outputDiv = document.getElementById("metadata");
            
            outputDiv.innerHTML = output;
            
            $(outputDiv).dialog({
                'modal' : true,
                width : '90%',
                height : $(window).height() / 1.25,
                resizable : true,
                draggable: true,
                'title' : 'Choose a data set',
                zIndex: 9999
            });
			$(outputDiv).scrollTop(0);
        },
        
        selectFeatureById : function(id) {
            logger.info('cswclient:selectFeatureById():: User has selected a feature from ScienceBase');
            
            var csw_response = getRecordById(id);
            var selectedFeature;
            
            // We are doing this because we don't know which format the data might be in, if we can tell, we shouldn't iterate
            var datasetSelectors = [
            '[nodeName="csw:GetRecordByIdResponse"] > [nodeName="csw:Record"] [nodeName="dc:URI"]',
            
            '[nodeName="csw:GetRecordByIdResponse"] > [nodeName="gmd:MD_Metadata"] > [nodeName="gmd:identificationInfo"] > \
                [nodeName="srv:SV_ServiceIdentification"] > [nodeName="srv:containsOperations"] > [nodeName="srv:SV_OperationMetadata"] > \
                [nodeName="srv:connectPoint"] > [nodeName="gmd:CI_OnlineResource"] > [nodeName="gmd:linkage"] > [nodeName="gmd:URL"]',
                
            '[nodeName="csw:GetRecordByIdResponse"] > [nodeName="gmd:MD_Metadata"] > [nodeName="gmd:distributionInfo"] > \
                [nodeName="gmd:MD_Distribution"] > [nodeName="gmd:transferOptions"] > [nodeName="gmd:MD_DigitalTransferOptions"] > \
                [nodeName="gmd:onLine"] > [nodeName="gmd:CI_OnlineResource"] > [nodeName="gmd:linkage"] > [nodeName="gmd:URL"]'
            ];
            
            for (var i=0; i<datasetSelectors.length; i++) {
                $(csw_response).find(datasetSelectors[i]).each(function(index, elem) {
                    var text = $(elem).text();
                    
                    if (text.toLowerCase().contains("wfs") || text.toLowerCase().contains("ows")) {
                        selectedFeature = text.indexOf('?') !== -1 ? text.substring(0, text.indexOf('?')) : text;
                    }
                    
                });
            }
            
            if (!selectedFeature) {
                logger.error('cswclient:selectFeatureById():: A feature couldnt be found in this CSW Record');
                showErrorNotification("No feature found for this CSW Record");
            } else {
                logger.info('cswclient:selectFeatureById():: Selected feature: ' + selectedFeature);
                
                Constant.endpoint.wfs = selectedFeature;
                Constant.endpoint.wms = selectedFeature;
                ScienceBase.itemId = id;
                ScienceBase.useSB = true;
                
                CSWClient.setSBConstraint();
                
                AOI.updateFeatureTypesList(function() {
                    var options = $(AOI.areasOfInterestSelectbox)[0].options;
                    
                    if (options.length === 1) {
                        // The return only came back with one item. Pick it
                        $(AOI.areasOfInterestSelectbox).val(options[0].label);
                        $(AOI.areasOfInterestSelectbox).trigger('change');
                        logger.info('cswclient:selectFeatureById():: Feature selected: ' + options[0].label);
                    } else if (options.length === 2) {
                        // If the return only has two items, pick the one that isn't
                        // footprint. Footprint feature seems to selectFeaturebe included in all 
                        // sciencebase features
                        $.each(options, function(index, item) {
                            if (item.label.toLowerCase() !== 'sb:footprint') {
                                $(AOI.areasOfInterestSelectbox).val(item.label);
                                $(AOI.areasOfInterestSelectbox).trigger('change');
                                logger.info('cswclient:selectFeatureById():: Feature selected: ' + item.label);
                            }
                        });
                    } else if (options.length > 2) {
                        // If we have more thwn 2 options, don't pick any because
                        // there's no way of knowing which one they picked from the 
                        // feature list returned from ScienceBase. Just get rid of 
                        // the available attributes and attribute values selectboxes
                        // and wipe the last geometry from the map, if it's there
                        var overlay = map.getLayersByName('Geometry Overlay')[0];
                        var hlOverlay = map.getLayersByName('Geometry Highlight Overlay')[0];
                        
                        logger.info('cswclient:selectFeatureById():: Multiple features found, none selected');
                        
                        $(AOI.availableAttributesSelectbox).fadeOut(Constant.ui.fadeSpeed);
                        $(AOI.availableAttributeValsSelectbox).fadeOut(Constant.ui.fadeSpeed);
                        
                        if (overlay) {
                            map.removeLayer(overlay);
                        }
                        if (hlOverlay) {
                            map.removeLayer(hlOverlay);
                        }
                    }
                    
                });

                $("#csw-output").dialog('close');
            }
        },
        selectSubdataset : function(selectedDataset, wmsURL, title, useCache) {
            
            Dataset.datasetSelected(selectedDataset, wmsURL, useCache);
            $(_DATASET_URL_INPUT_BOX).val(selectedDataset);
            if (parseInt(Constant.ui.view_show_csw_chosen_dataset_title) && title) {
                $(_DATASET_SELECTED_TITLE).fadeOut(Constant.fadeSpeed, function(){
                    $(_DATASET_SELECTED_TITLE).html('Selected Dataset: ' + title);
                    $(_DATASET_SELECTED_TITLE).fadeIn(Constant.fadeSpeed);
                });
            }
            $('#metadata').dialog('close');
            $("#csw-output").dialog('close');
        },
        selectDatasetById : function(id, title) {
            var csw_response = getRecordById(id);
            var selectedDataset;
            var shouldUseCache = false;
            var wmsURL;
            
            // We are doing this because we don't know which format the data might be in, if we can tell, we shouldn't iterate
            var datasetSelectors = [
            '[nodeName="csw:GetRecordByIdResponse"] > [nodeName="csw:Record"] [nodeName="dc:URI"]',
            
            '[nodeName="csw:GetRecordByIdResponse"] > [nodeName="gmd:MD_Metadata"] > [nodeName="gmd:identificationInfo"] > \
                [nodeName="srv:SV_ServiceIdentification"] > [nodeName="srv:containsOperations"] > [nodeName="srv:SV_OperationMetadata"] > \
                [nodeName="srv:connectPoint"] > [nodeName="gmd:CI_OnlineResource"] > [nodeName="gmd:linkage"] > [nodeName="gmd:URL"]',
            
            '[nodeName="csw:GetRecordByIdResponse"] > [nodeName="gmd:MD_Metadata"] > [nodeName="gmd:distributionInfo"] > \
                [nodeName="gmd:MD_Distribution"] > [nodeName="gmd:transferOptions"] > [nodeName="gmd:MD_DigitalTransferOptions"] > \
                [nodeName="gmd:onLine"] > [nodeName="gmd:CI_OnlineResource"] > [nodeName="gmd:linkage"] > [nodeName="gmd:URL"]'
                
            ];
            var shouldCacheSelectors = [
            '[nodeName="csw:GetRecordByIdResponse"] > [nodeName="gmd:MD_Metadata"] > [nodeName="gmd:identificationInfo"] > \
                    [nodeName="gmd:MD_DataIdentification"] > [nodeName="gmd:status"] > [nodeName="gmd:MD_ProgressCode"]'
            ];
            
            for (var i=0; i<datasetSelectors.length; i++) {
                $(csw_response).find(datasetSelectors[i]).each(function(index, elem) {
                    var text = $(elem).text();
                    

                    if (text.toLowerCase().contains("dods")) {
                        Dataset.setDatasetType(Dataset.datasetTypeEnum.OPENDAP);
                        selectedDataset = text.indexOf('?') !== -1 ? text.substring(0, text.indexOf('?')) : text;
                    }
                    else if (text.toLowerCase().contains("wcs") && !selectedDataset) {
                        Dataset.setDatasetType(Dataset.datasetTypeEnum.WCS);
                        selectedDataset = text.indexOf('?') !== -1 ? text.substring(0, text.indexOf('?')) : text;
                    }
                    else if (text.toLowerCase().contains("wms")) {
                        wmsURL = text.indexOf('?') !== -1 ? text.substring(0, text.indexOf('?')) : text;
                    }
                });
            }
            
            for (i=0; i<shouldCacheSelectors.length; i++) {
                $(csw_response).find(shouldCacheSelectors[i]).each(function(index, elem) {
                    var codeListValue = $(elem).attr("codeListValue");
                    
                    if (codeListValue.toLowerCase() === "completed") {
                        shouldUseCache = true;
                    }
                });
            }
            
            if (!selectedDataset) {
                showErrorNotification("No dataset found for this CSW Record");
            }
            else {
                Dataset.datasetSelected(selectedDataset, wmsURL, shouldUseCache);
                $(_DATASET_URL_INPUT_BOX).val(selectedDataset);
                if (parseInt(Constant.ui.view_show_csw_chosen_dataset_title)) {
                    $(_DATASET_SELECTED_TITLE).fadeOut(Constant.fadeSpeed, function(){
                        $(_DATASET_SELECTED_TITLE).html('Selected Dataset: ' + title);
                        $(_DATASET_SELECTED_TITLE).fadeIn(Constant.fadeSpeed);
                    });
                }

                $("#csw-output").dialog('close');
            }
        },
        popupMetadataById : function(id) {
            var csw_response = getRecordById(id);
            
            return handleCSWResponse("getrecordbyid", csw_response);
        }
    };
};
