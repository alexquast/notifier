/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2004-2010 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

/**
 * Abstraction to do local-storage on all different devices.
 * Supports key-value storage
 *
 */


/**
 * An abstract storage class
 *
 * Storage holds everything to handle localstorage for
 * different browsers. Storage specific usage is hidden
 * away. Therefore storage defines following methods to
 * do the job
 *
 * getMode()
 * returns 0-3 for storageModes (s. below)
 *
 * setItem(key, value, json)
 * saves an item in store
 * key and value are strings. If json is set to true
 * every persistable datatype is saved to a
 * valid json string
 *
 * getItem(key,json)
 * gets the via key specified value. If json is set to
 * true a json object is returned
 *
 * deleteItem(key)
 * deletes the via key specified item from store
 *
 * flushStorage()
 * cleans whole storage
 *
 * length()
 * returns number of entries in storage
 *
 */

var storage = { };

storage.init = function (mode) {
    storage.modeList = {
        3: "localStorage",
        2: "globalStorage",
        1: "SQLiteDB",
        0: "NoStorage"
    };
	// private Constants------------
	var MODE_HTML5  = 3; //localStorage
	var MODE_GECKO  = 2; //globalStorage
	var MODE_DB     = 1; //sqlite DB
	var MODE_FAIL   = 0; //nothing

	var DB_MAXSIZE  = 1048576;
	var DB_VERSION  = '1.0';
	var DB_NAME		= 'oxDB';
	var DB_DISPLAYNAME = 'OX Mobile Web App';
	var STORAGE_PREFIX = "ox.";
	//------------------------------

	// private variables -----------
	var data ={};
	var storageMode;
	var storageDriver;
	//------------------------------


	//public getters----------------

	function getMode(){
        if(localUserConfig.localStorage === false) {
             return 0;
        }
		return storageMode;
	}

	function setMode (mode) {
	    switch (mode) {
	        case 3:
	            storageMode = MODE_HTML5;
	            break;
	        case 2:
	            storageMode = MODE_GECKO;
	            break;
	        case 1:
	            storageMode = MODE_DB;
	            break;
	        case 0:
	            storageMode = MODE_FAIL;
	    }
	}

	//public functions--------------
	var createStorage,

		flushStorage,

		insertItem,

		getItem,

		setItem,

		removeItem,

		length,

		setMode,

		setPrefix;

	//-------------------------------
	//-Implementation----------------

	// Determine the best available storage mode.
	if (window.localStorage) {
	    storageMode = MODE_HTML5;
	} else if (window.globalStorage) {
	    storageMode = MODE_GECKO;
	} else if (window.openDatabase && navigator.userAgent.indexOf('Chrome') === -1) {
	    storageMode = MODE_DB;
	} else {
	    storageMode = MODE_FAIL;
	}
	// hook for hybrid app
	// these must use sqlite
	if (isHybridApp) {
		storageMode = MODE_DB;
	}

	if (mode) {
		setMode(mode);
	}

	if (storageMode === MODE_HTML5 || storageMode === MODE_GECKO){

		// functions equal for both modes

		length = function(){
			return storageDriver.length;
		};

		removeItem = function(key) {
		    key = STORAGE_PREFIX + key;
			storageDriver.removeItem(key);
		};

		setItem = function(key, value, json, force) {
			var extra = (force !== undefined) ? 'iwillstay.' : '';
		    key = extra + STORAGE_PREFIX + key;
			storageDriver.setItem(key, json ? JSON.stringify(value) : value);
		};

		if(storageMode === MODE_HTML5){

			// HTML5 localStorage, supportet by IE 8, FF 3.5 +, Safari 4+,
			// Chrome 4+, Opera 10.5+

			storageDriver = window.localStorage;

			flushStorage = function (force) {
				if (force) {
					storageDriver.clear();
					return;
				}
				var temp = [];
				// keep entries marked with IWILLSTAY
				for (var i = 0; i < storageDriver.length; i++) {
					var value = storageDriver.getItem(storageDriver.key(i));
					if (/iwillstay./.test(storageDriver.key(i))) {
						temp.push({
							key: storageDriver.key(i),
							value: storageDriver.getItem(storageDriver.key(i), true)
						});
					}
				}
				storageDriver.clear();
				for (var k = 0; k < temp.length; k++) {
					storageDriver.setItem(temp[k].key, temp[k].value, true);
				}
			};

			getItem = function(key, json, persistent) {
			    var extra = (persistent !== undefined) ? 'iwillstay.' : '';
			    key = extra + STORAGE_PREFIX + key;
				try {
					return json ? JSON.parse(storageDriver.getItem(key)):
						storageDriver.getItem(key);
				} catch (exception) {
					//mox.error.newError("[Storage engine] Error getting Item, ", exception);
					return null;
				}

			};
		} else if (storageMode === MODE_GECKO) {

			//globalStorage methods for FF 2, 3.0
			storageDriver = window.globalStorage[window.location.hostname];

			flushStorage = function(){
				for (var key in storageDriver){
					if(storageDriver.hasOwnProperty(key)){
						storageDriver.removeItem(key);
						delete storageDriver[key];
					}
				}
			};

			getItem = function(key, json){
			    key = STORAGE_PREFIX + key;
				try{
					return json ? JSON.parse(storageDriver[key].value) :
						storageDriver[key].value;

				} catch(exception) {
					//mox.error.newError("[Storage engine] Error getting Item, ", exception);
					return null;
				}

			};
		}

	} else if(storageMode === MODE_DB){
		storageDriver = window.openDatabase(DB_NAME, DB_VERSION, DB_DISPLAYNAME, DB_MAXSIZE);

		function saveDB(){
			storageDriver.transaction(function(e){
				e.executeSql("REPLACE INTO mox (name,value) VALUES ('data',?)",[JSON.stringify(data)]);
			});
		}

		storageDriver.transaction(function(e){
				// create new database for key-value storage

				e.executeSql("CREATE TABLE IF NOT EXISTS mox (name TEXT PRIMARY KEY, value TEXT NOT NULL)");
				e.executeSql("SELECT value FROM mox WHERE name='data'", [],function(t, result){
					if (result.rows.length) {
						try{
							data = JSON.parse(result.rows.item(0).value);

						}catch(exception){
                            console.log(exception);
							//mox.error.newError("[Storage engine] Error during transaction, ", exception);
							data = {};
						}
					}

			});
		});


		flushStorage = function(force) {
			// keep prefixed data
			if (force) {
				data = {};
			} else {
				var keepme = {};
				for (entry in data) {
					if (/iwillstay./.test(entry)) {
						keepme[entry] = data[entry];
					}
				}
				data = keepme;
			}
			saveDB();
		};

		setItem = function(key, value, json, force){
		    var extra = (force !== undefined) ? 'iwillstay.' : '';
		    key = extra + STORAGE_PREFIX + key;
			data[key] = value;
			saveDB();
		};

		getItem = function(key, json, persistent) {
			var extra = (persistent !== undefined) ? 'iwillstay.' : '';
			key = extra + STORAGE_PREFIX + key;
			return data.hasOwnProperty(key) ? data[key] : null;
		};

		removeItem = function(key){
		    key = STORAGE_PREFIX + key;
			delete data[key];
			saveDB();
		};

		length = function(){
			var count = 0;
			for (key in data) {
				if(data.hasOwnProperty(key)){
					count += 1;
				}
			}
			return count;
		};

		setPrefix = function(prefix) {
		    STORAGE_PREFIX = prefix;
		};

	} else {
		//This is FAIL_MODE

	}

	// assign to namespace and make public
	storage.getMode = getMode;
	storage.setItem = setItem;
	storage.getItem = getItem;
	storage.length = length;
	storage.flushStorage = flushStorage;
	storage.removeItem = removeItem;
    storage.storageDriver = storageDriver;
    storage.setMode = setMode;
    storage.setPrefix = setPrefix;
};

// init
storage.init();
/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 * 
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * 
 * Copyright (C) 2004-2010 Open-Xchange, Inc.
 * Mail: info@open-xchange.com 
 * 
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */


/**
 * restoreStorageData
 * restores data from localstorage in case of missing
 * network connection. 
 */

datastore = {
    restoreUserData: function() {
        try {
            // foldertree
            localUserConfig.folderTree = storage.getItem("folderTree", true);
            // user data
            userData = storage.getItem("userData", true);
            // the user id
            userID = storage.getItem("userID", true);
            // folder ID map
            mox.mail.folderIDMap = storage.getItem("folderIDMap", true);
        } catch (e) {
            mox.error.newError("[STORAGE] Error restoring user data.");
        }
        $(events).trigger("config-loaded"); // fake trigger
    },
    restoreMail: function() {
        try {
            // just metadata for mail folders
            mailLists = storage.getItem("mailLists", true);
            $.extend(unreadMails, storage.getItem("unreadMails", true));

            var mailfolderoptions = storage.getItem("mailFolderOptions", true);
            var mails;
            $.each(mailLists, function(i, elem) {
                 mails = storage.getItem(elem.location, true);
////                 unreadMails[elem.id] = 0;
//                 $.each(mails.data, function(j , jelem) {
//                     if ((jelem[4] & 32) === 0) {
////                         unreadMails[elem.id]++;
//                     }
//                 });
                //draw the list
                var options = {
                    foldername: elem.name,
                    folderid: elem.id,
                    mails: mails.data,
                    mailList: mailfolderoptions[i],
                    standardfolder: elem.standardfolder
                };
                
                mox.mail.drawMailList(options, {update: false});
            });
            // already loaded mails
            loadedMails = storage.getItem("loadedMails", true);
        
        } catch (e) {
            mox.error.newError("Error restoring mails.");
        }
        // update count bubbles
        //ui.mail.updateCountBubbles();
    },
    restoreContacts: function() {
        try {
            // restore all contacts
            mox.contacts.completeContactList = storage.getItem("contacts", true);
            mox.contacts.contactFolders = storage.getItem("contactFolders", true);
            
        } catch (e) {
           mox.error.newError("[STORAGE] Error restoring contacts.");
           return false;
        }

        if (mox.contacts.completeContactList !== null) {
            // write all contacts
            mox.contacts.writeContactList({
                list : {
                    data : mox.contacts.completeContactList
                },
                data : [ "all", "contacts", "Globalcontacts" ]
            });
        } else {
            return false;
        }
        // finished?
        return !!mox.contacts.completeContactList;
    },
    restoreAppointments: function() {
        // new list
        globalAppointmentListView = new AppointmentListView();
        
        try {
            // get all appointments
            mox.calendar.appointmentLists.all = storage.getItem("appointments", true);

            // resources
            resolvedContextResources = storage.getItem("contextResources", true);
            resolvedContextGroups = storage.getItem("contextGroups", true);
            mox.contextData.contextUsers = storage.getItem("contextUsers", true);
            
        } catch (e) {
            mox.error.newError("[STORAGE] Error restoring appointments.");
        }
        
        var obj = mox.calendar.appointmentLists.all.data;
        
        if ( obj.length === 0 ) {
            globalAppointmentListView.showEmptyMessage();
        }
        var resolvelist = [];
        
        $.each(obj, function(k, elem) {
            
            globalAppointmentListView.addRow(elem);
            
            $.each(elem[10], function(l, elem2) {
                if( (elem2.id !== undefined) && (elem2.type === 1) ) {
                    // found a user, add to resolve list if not already done
                    if (resolvelist.find(elem2.id) === false) {
                        resolvelist.push(elem2.id);
                    }
                }
            });
        });
    },
    restoreData: function() {
        /* pageloading */
        mox.error.newError("[INFO] Starting offline mode, restoring data.");
        // fake the session check for offline mode
        window.session = "offline";
        this.restoreUserData();
        this.restoreContacts();
        this.restoreAppointments();
        this.restoreMail();
        /* pageloading */
    }
};

var underscore = _;
/**
 * util holds various helper methods
 */

var util = {};

/**
 * util to measure time in functions.
 * Create new instance, call start and stop to
 * get ms of duration between the two calls
 * @return {stopwatch} new stopwatch
 */
util.stopwatch = function () {
    var t1, t2;
    this.start = function () {
        t1 = new Date();
        return this;
    },
    this.stop = function () {
        t2 = new Date();
        console.info(t2.getTime() - t1.getTime() + 'ms');
        return t2.getTime()-t1.getTime();
    }
}

util.isIOS6 = function () {
    // test for iOS 6.x
    return  !!( /iPhone|iPad|iPod/.test( navigator.platform ) && /OS [6]_[0-9_]* like Mac OS X/i.test(navigator.userAgent) && navigator.userAgent.indexOf( "AppleWebKit" ) > -1 );
}

util.isFormLogin = function () {
    var hash = window.location.hash,
        params, sessionObject;
    if (hash.match(/session/)) {
        console.log(hash);
        // remove hash
        params = hash.substr(1, hash.length).split('&');
        // look for session

        if (_.isArray(params)) {
            sessionObject = {};
            _(params).each(function (elem) {
                sessionObject[elem.split('=')[0]] = elem.split('=')[1];
            });
        }


        _.debug('found formlogin session ', sessionObject);
    }
    return sessionObject;
}

util.date = {

    formatDate: function(timestamp, format) {
        var date = new Date(timestamp);
        var formateddate;
        var today = new Date();
        today.setHours(0, 0, 0, 0); // today at 00:00
        var yesterday = new Date(today);
        yesterday.setDate(today.getDate()-1);

        if (date > today) {
            formateddate = formatDate(date,"time").toString();
        } else if (date < today && date > yesterday) {
            formateddate = _i18n("Yesterday").toString();
        } else {
            formateddate = formatDate(date,format).toString();
        }
        return formateddate;
    },
    equalsDay: function(date1, date2) {
        if ( date1.getUTCDate() === date2.getUTCDate() &&
                date1.getUTCMonth() === date2.getUTCMonth() &&
                date1.getUTCFullYear() === date2.getUTCFullYear() ) {
            return true;
        } else return false;
    }
};

util.getBrowserLang = function() {
    var lang;
    var match = /(\w+)([-_](\w+))?/.exec(navigator.language || navigator.userLanguage);
    if (match) {
        if (match[2]) {
            lang = match[1].toLowerCase() + "_" + match[3].toUpperCase();
            if (! {
                "de_DE" : true,
                "en_US" : true,
                "fr_FR" : true,
                "en_GB" : true,
                "es_ES" : true,
                "it_IT" : true,
                "nl_NL" : true,
                "pl_PL" : true,
                "ja_JP" : true

            }[lang]) {
                lang = {
                        de : "de_DE",
                        en : "en_US",
                        fr : "fr_FR"
                    }[match[1].toLowerCase()] || "en_US";
            }

        } else
            lang = {
                de : "de_DE",
                en : "en_US",
                fr : "fr_FR",
                es : "es_ES",
                it : "it_IT",
                nl : "nl_NL",
                pl : "pl_PL",
                ja : "ja_JP"
            }[match[1].toLowerCase()] || "en_US";
    }
    // special handling for hybrid app on android
    // phonegaps webview always returns en as language for navigator.language
    // we have to parse the user agent
    if (isHybridApp === true && device === "android") {
        var parts = navigator.userAgent.match(/android.*\W(\w\w)-(\w\w)\W/i);
        lang = parts[1].toLowerCase() + "_" + parts[2].toUpperCase();
        if (! {
            "de_DE" : true,
            "en_US" : true,
            "fr_FR" : true,
            "en_GB" : true,
            "es_ES" : true,
            "it_IT" : true,
            "nl_NL" : true,
            "pl_PL" : true,
            "ja_JP" : true

        }[lang]) {
            lang = "en_US";
        }
    }
    return lang;
};

util.uuid = function() {
    function hex(len, x) {
        if (x === undefined) x = Math.random();
        var s = new Array(len);
        for (var i = 0; i < len; i++) {
            x *= 16;
            var digit = x & 15;
            s[i] = digit + (digit < 10 ? 48 : 87); // '0' and 'a' - 10
        }
        return String.fromCharCode.apply(String, s);
    }
    return [hex(8), "-", hex(4), "-4", hex(3), "-",
            hex(4, 0.5 + Math.random() / 4), "-", hex(12)].join("");
};

util.round = function (num, digits) {
    digits = digits || 0;
    var pow = Math.pow(10, digits);
    return Math.round(num * pow) / pow;
};

/**
 * generates a random string of given length
 */
util.randomString = function (length) {
    var str = '';
    for ( ; str.length < length; str += Math.random().toString(36).substr(2) );
    return str.substr(0, length);
};
/**
 * look for failsafe option in get params
 */
util.isFailSafe = function () {
    var k = [];
    try {
        var t = window.location.search;
        if(t.length > 0) {
            t = t.substr(1);
            k = t.split("=");
        }
    } catch(e) {}
    if(k[0] === "failsafe") {
        return !!k[1] || false;
    }
};
/**
 * extract params from url
 */
util.getUrlParams = function () {
   var l = window.location.search;
   if (!l) return {};
   var paramsString = l.substr(1, l.length),
        kram = paramsString.split('&'),
        object = {};
   _.each(kram, function(p) {
        object[p.split('=')[0]] = p.split('=')[1];
   });
   return object;
};
/**
 * android hack to fix messed up form scrolling
 * DEPRECATED
 */
util.enableFixScroll = function(e) {
    if (e === true) {
        $("body").css("overflow","hidden");
    } else {
        $("body").css("overflow","");
    }

};

/**
 *  ajax GET
 *  we need this on for loading PO files. jQuery ajax in this version
 *  can not deal with response code 0
 */
// we need a own GET function for iPhone app cache loading
util.GET = function(obj) {
    if(obj.url === undefined){
        return false;
    }
    var req;

    var processReqChange = function() {
    // only if req shows "loaded"

        if (req.readyState === 4) {
            // only if "OK"
            if (req.status === 0) {
                // special case for iPhone app cache behavior
                obj.success(req.responseText);
            }else if (req.status === 200) {
                obj.success(req.responseText);
            } else {
                obj.error(req.statusText);
                _.debug("There was a problem retrieving the XML data:\n" +
                    req.statusText);
            }
        }
    };
    var loadXMLDoc = function (url) {
        req = false;
        // branch for native XMLHttpRequest object
        if(window.XMLHttpRequest && !(window.ActiveXObject)) {
            try {
                req = new XMLHttpRequest();
            } catch(e) {
                mox.error.newError("[XML HTTP Request] Error ", e);
                req = false;
            }
        // branch for IE/Windows ActiveX version
        } else if(window.ActiveXObject) {
            try {
                req = new ActiveXObject("Msxml2.XMLHTTP");
            } catch(e) {
                try {
                    req = new ActiveXObject("Microsoft.XMLHTTP");
                } catch(e) {
                     mox.error.newError("[XML HTTP Request] Error ", e);
                    req = false;
                }
            }
        }
        if(req) {
            req.onreadystatechange = processReqChange;
            req.open("GET", url, true);
            req.send("");
        }
    };
    loadXMLDoc(obj.url);
};


/**
 * get permissons from an ox permission bitmask
 */
util.getPermission = function (nBits, nOffset) {
    // helper
    var f = function (mask, strings) {
        nBits = (nBits >> nOffset) & mask;
        return { string: strings[nBits], bit: nBits };
    };
    // which offset?
    switch (nOffset) {
    case 0:
        return f(127, {
            0: "None", /*i18n*/
            1: "Visible folder", /*i18n*/
            2: "Create objects", /*i18n*/
            4: "Create subfolders", /*i18n*/
            64: "Maximum"/*i18n*/
        });
    case 7:
        return f(127, {
            0: "None", /*i18n*/
            1: "Read own", /*i18n*/
            2: "Read all", /*i18n*/
            64: "Maximum" /*i18n*/
        });
    case 14:
        return f(127, {
            0: "None", /*i18n*/
            1: "Modify own", /*i18n*/
            2: "Modify all", /*i18n*/
            64: "Maximum" /*i18n*/
        });
    case 21:
        return f(127, {
            0: "None", /*i18n*/
            1: "Delete own", /*i18n*/
            2: "Delete all", /*i18n*/
            64: "Maximum" /*i18n*/
        });
    case 28:
    case 29:
        return f(1, {
            0: "No", /*i18n*/
            1: "Yes" /*i18n*/
        });
    }
};
/**
 * escape html special chars
 */
util.escapeHTML = function (string) {
    if (string) {
        return string.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    } else {
        return "";
    }
};

/**
 * findInArray
 * looks for an object in an array witch matches property and value
 */
util.findInArray = function (array, property, value) {
    var id = false;
    $.each(array, function(i,elem) {
        if(elem[property] !== undefined) {
            if (elem[property] == value) {
                id = i;
            }
        }
    });
    return id;
};


/*
 * Geolocation testing

function Location(){
    var latitude, longitude, callback;

    function checkGeoLocation() {
        return navigator.geolocation;
    }
    function updateLocation(fn) {
        if (checkGeoLocation())
        {
            callback = fn;
            navigator.geolocation.getCurrentPosition(savePosition);
            return true;
        } else {
            _.debug('Device not capable of geo-location.');
            fn(false);
            return false;
        }
    }
    function savePosition(position) {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        if (callback) {
            callback(getLocation());
        }
    }
    function getLocation() {
        if (latitude && longitude) {
            return {
                latitude: latitude,
                longitude: longitude
            };
        } else {
            _.debug('No location available. Try calling updateLocation() first.');
            return false;
        }
    }
    return {
        updateLocation: updateLocation,
        getLocation: getLocation
    };
}
*/

util.appCache = (function() {
    var appCache = window.applicationCache;
        var cache = {
        getStatus : function() {
            switch (appCache.status) {
                case appCache.UNCACHED: // UNCACHED == 0
                    return 'UNCACHED';
                case appCache.IDLE: // IDLE == 1
                    return 'IDLE';
                case appCache.CHECKING: // CHECKING == 2
                    return 'CHECKING';
                case appCache.DOWNLOADING: // DOWNLOADING == 3
                    return 'DOWNLOADING';
                case appCache.UPDATEREADY: // UPDATEREADY == 4
                    return 'UPDATEREADY';
                case appCache.OBSOLETE: // OBSOLETE == 5
                    return 'OBSOLETE';
                default:
                    return 'UKNOWN CACHE STATUS';
            }
        },
        swapCache : function() {
            appCache.update();
        },
        updateCache : function() {
            appCache.swapCache();
        }
    };
    return cache;
})();

/**
 * returns actual date without actual time
 */
function thisDay(offset) {
    var t = new Date();
    var k = new Date(t.getUTCFullYear(),t.getUTCMonth(), t.getUTCDate(), Math.ceil((offset / 1000 / 60 /60)));
    return k;
}

/**
 * replaces newline with HTML breaks
 * @param {Object} myString
 */
function nl2br(myString){
    var regX = /\n/gi;
    s = new String(myString);
    s = s.replace(regX, "<br /> \n");
    return s;
}


/**
 * empty Function
 */
var eF = function(){};

/**
 * custom typeOf function
 * @param value
 * @return
 */
function typeOf(value) {
    var s = typeof value;
    if (s === 'object') {
        if (value) {
            if (value instanceof Array) {
                s = 'array';
            }
        }
        else {
            s = 'null';
        }
    }
    return s;
}


/**
 * Adding search to arrays
 * @param searchStr
 * @return
 */
Array.prototype.find = function(searchStr){
    var returnArray = false;
    for (i = 0; i < this.length; i++) {
        if (typeof(searchStr) == 'function') {
            if (searchStr.test(this[i])) {
                if (!returnArray) {
                    returnArray = [];
                }
                returnArray.push(i);
            }
        }
        else {
            if (this[i] === searchStr) {
                if (!returnArray) {
                    returnArray = [];
                }
                returnArray.push(i);
            }
        }
    }
    return returnArray;
};

Array.prototype.last = function(){
    return this.length - 1;
};

Array.prototype.compare = function(testArr) {
    if (this.length != testArr.length) {
         return false;
    }
    for (var i = 0; i < testArr.length; i++) {
        if (this[i].compare) {
            if (!this[i].compare(testArr[i])) {
                return false;
            }
        }
        if (this[i] !== testArr[i]) {
            return false;
        }
    }
    return true;
};


/**
 * Read cookie with given name
 * @param c_name
 * @return false if no cookie was found
 */
util.getCookie = function(cookieName) {
    var cStart;
    var cEnd;
    if (document.cookie.length > 0) {
        cStart = document.cookie.indexOf(cookieName + "=");
        if (cStart != -1) {
            cStart = cStart + cookieName.length + 2;
            cEnd = document.cookie.indexOf(";", cStart);
            if (cEnd === -1) {
                cEnd = document.cookie.length;
            }
            return unescape(document.cookie.substring(cStart, cEnd));
        }
    }
    return false;
};

/**
 * Sets a cookie with given name and expiry date
 * If expiry = -1 cookie is erased
 * @param name of cookie
 * @param value of cookie
 * @param expiry lifetime in millisecond, -1 for erase
 * @return
 */
util.setCookie = function(name, value, expiry) {
    var date = new Date();
    date.setTime(date.getTime() + expiry);
    if (expiry === -1) {
        date.setTime(1);
    }
    var expires ="" ;
    if (expiry) {
        expires = "; expires=" + date.toGMTString();
    }
    document.cookie = name + "=" +  value + expires + "; path=/";
};

util.testCookieSettings = function() {
    util.setCookie("cookietest", "true", 60000);
    var state = util.getCookie("cookietest");
    util.setCookie("cookietest", "true", -1);
    return (isHybridApp) ? true : !!state;
};



(function (_) {

    // browser detection
    // adopted from prototype.js
    var ua = navigator.userAgent,
        isOpera = Object.prototype.toString.call(window.opera) === "[object Opera]",
        webkit = ua.indexOf('AppleWebKit/') > -1,
        chrome = ua.indexOf('Chrome/') > -1;

    // deserialize
    var deserialize = function (str, delimiter) {
        var pairs = (str || "").split(delimiter === undefined ? "&" : delimiter);
        var i = 0, $l = pairs.length, pair, obj = {}, d = decodeURIComponent;
        for (; i < $l; i++) {
            pair = pairs[i];
            var keyValue = pair.split(/\=/), key = keyValue[0], value = keyValue[1];
            if (key !== "" || value !== undefined) {
                obj[d(key)] = d(value);
            }
        }
        return obj;
    };

    // get hash & query
    var queryData = deserialize(document.location.search.substr(1), /&/),
        hashData = deserialize(document.location.hash.substr(1), /&/);

    // extend underscore utilities
    _.extend(_, {
        debug: function() {
            if (debug) {
                // get requested debug level
                var dbgLvl = typeof arguments[0] === 'number' && arguments[0] > 0 && arguments[0] < 10 ? arguments[0] : 0;
                // get global debug level;
                showDebugLevel = typeof showDebugLevel === 'number' && showDebugLevel > 0 && showDebugLevel < 10 ? showDebugLevel : 0;

                if (dbgLvl > 0) {
                    arguments[0] = 'LVL' + dbgLvl;
                }
                if (!window.console) {
                    window.console = {};
                }
                if (!window.console.info) {
                    window.console.info = function () {};
                }
                if (!showDebugLevel || showDebugLevel === dbgLvl) {
                    console.info(arguments);
                }
            }
        },
        browser: {
            /** is IE? */
            IE: navigator.appName !== "Microsoft Internet Explorer" ? undefined
                : Number(navigator.appVersion.match(/MSIE (\d+\.\d+)/)[1]),
            /** is Opera? */
            Opera: isOpera,
            /** is WebKit? */
            WebKit: webkit,
            /** Safari */
            Safari: webkit && !chrome,
            /** Safari */
            Chrome: webkit && chrome,
            /** is Gecko/Firefox? */
            Gecko:  ua.indexOf('Gecko') > -1 && ua.indexOf('KHTML') === -1,
            /** MacOS **/
            MacOS: ua.indexOf('Macintosh') > -1
        },

        /**
         * Serialize object (key/value pairs) to fit into URLs (e.g. a=1&b=2&c=HelloWorld)
         * @param {Object} obj Object to serialize
         * @param {string} [delimiter] Delimiter
         * @returns {string} Serialized object
         * @example
         * _.serialize({ a: 1, b: 2, c: "text" });
         */
        serialize: function (obj, delimiter) {
            var tmp = [], e = encodeURIComponent, id;
            if (typeof obj === "object") {
                for (id in (obj || {})) {
                    if (obj[id] !== undefined) {
                        tmp.push(e(id) + "=" + e(obj[id]));
                    }
                }
            }
            return tmp.join(delimiter === undefined ? "&" : delimiter);
        },

        /**
         * Deserialize object (key/value pairs)
         * @param {string} str String to deserialize
         * @param {string} [delimiter] Delimiter
         * @returns {Object} Deserialized object
         * @function
         * @name _.deserialize
         * @example
         * _.deserialize("a=1&b=2&c=text");
         */
        deserialize: deserialize,

        url: {
            /**
             * @param name {string} [Name] of the query parameter
             * @returns {Object} Value or all values
             */
            param: function (name) {
                return name === undefined ? queryData : queryData[name];
            },
            /**
             * @param {string} [name] Name of the hash parameter
             * @returns {Object} Value or all values
             */
            hash: function (name) {
                return name === undefined ? hashData : hashData[name];
            }
        },

        /**
         * This function simply writes its parameters to console.
         * Useful to debug callbacks, e.g. event handlers.
         * @example
         * http.GET({ module: "calendar", params: { id: 158302 }, success: _.inspect });
         */
        inspect: function () {
            var args = $.makeArray(arguments);
            args.unshift("Inspect");
            if (window.console !== undefined) {
                console.debug.apply(console, args);
            }
        },

        /**
         * Call function if first parameter is a function (simplifies callbacks)
         * @param {function ()} fn Callback
         */
        call: function (fn) {
            if (_.isFunction(fn)) {
                var i = 1, $l = arguments.length, args = [];
                for (; i < $l; i++) {
                    args.push(arguments[i]);
                }
                return fn.apply(fn, args);
            }
        },

        /**
         * Return current time as timestamp
         * @returns {long} Timestamp
         */
        now: function () {
            return (new Date()).getTime();
        },

        /**
         * Return the first parameter that is not undefined
         */
        firstOf: function () {
            var args = $.makeArray(arguments), i = 0, $l = args.length;
            for (; i < $l; i++) {
                if (args[i] !== undefined) {
                    return args[i];
                }
            }
            return undefined;
        },

        /**
         * Clone object
         * @param {Object} elem Object to clone
         * @returns {Object} Its clone
         */
        deepClone: function (elem) {
            if (typeof elem !== "object") {
                return elem;
            } else {
                var subclone = function (elem) {
                    if (!elem) {
                        return null;
                    } else {
                        var tmp = _.isArray(elem) ? [] : {}, prop, i;
                        for (i in elem) {
                            prop = elem[i];
                            tmp[i] = typeof prop === "object" && !_.isElement(prop) ? subclone(prop) : prop;
                        }
                        return tmp;
                    }
                };
                return subclone(elem);
            }
        },

        /**
         * "Lastest function only
         * Works with non-anonymous functions only
         */
        lfo: function () {
            // call counter
            var curry = $.makeArray(arguments),
                fn = curry.shift(),
                count = (fn.count = (fn.count || 0) + 1);
            // wrap
            return function () {
                if (count === fn.count) {
                    fn.apply(fn, $.merge(curry, arguments));
                }
            };
        },

        /**
         * Format
         */
        printf: function (str, params) {
            // is array?
            if (!_.isArray(params)) {
                params = $.makeArray(arguments).slice(1);
            }
            var index = 0;
            return String(str)
                .replace(
                    /%(([0-9]+)\$)?[A-Za-z]/g,
                    function (match, pos, n) {
                        if (pos) { index = n - 1; }
                        return params[index++];
                    }
                )
                .replace(/%%/, "%");
        },

        /**
         * Format error
         */
        formatError: function (e, formatString) {
            return _.printf(
                formatString || "Error: %1$s (%2$s, %3$s)",
                _.printf(e.error, e.error_params),
                e.code,
                e.error_id
            );
        },

        pad: function (val, length, fill) {
            var str = String(val), n = length || 1, diff = n - str.length;
            return (diff > 0 ? new Array(diff + 1).join(fill || "0") : "") + str;
        }
    });

}(underscore));


(function($){
    $.txt = function (str) {
        return document.createTextNode(str !== undefined ? str : '');
    };
})(jQuery);

var HOSTONLY =  window.location.protocol + "//" + window.location.host;
var HOST = HOSTONLY + "/ajax";

// debug mode on or off
var debug = false;
if (util.getUrlParams().debug) debug = true;

// check for formlogin
var formLoginSession = util.isFormLogin();

var showDebugLevel = 0;
var FAILSAFE = false;
var device = "";
var isHybridApp = false;
// namespace for api
var mox = { };
// empty object for registering events
var events = { };
var online = navigator.onLine;
var MAXCONTACTS = 200;
var userID, userData, url, session;
//one list for each folder
var mailLists = [];

//mails loaded once
var loadedMails = [];

// mod_jk needs the jsessionid in lower case to be recognized in a get request
var JSESSIONID = "jsessionid";

var autocomplete = false;

// define global transitions

var transitions = {
    enabled: true,
    defaultTransition: "slide",
    slide: "slide",
    slideup: "slideup",
    slidedown: "slidedown",
    fade: "fade"
};

/**
 * a transitionhandler which only waits for 350ms to show
 * the next page. This one is used for android devices
 * @param name
 * @param reverse
 * @param $toPage
 * @param $fromPage
 * @returns
 */
var delayTransitionhandler = function( name, reverse, $toPage, $fromPage ) {
    var def = $.Deferred();
    // delay this action for 350ms
    setTimeout(function () {
        if ( $fromPage ) {
            $fromPage.removeClass( $.mobile.activePageClass );
        }
        $toPage.addClass( $.mobile.activePageClass );

        def.resolve( name, reverse, $toPage, $fromPage );
    }, 50);

    return def.promise();
};


if (window.addEventListener) {
    // events for online and offline mode
    window.addEventListener("online", function() {
       online = true;
    }, false);

    window.addEventListener("offline", function() {
       online = false;
    }, false);
}

/**
 * global stats and variables
 */

// global config for jQuery ajax
$.ajaxSetup({
    dataType: "json",
    contentType: 'text/javascript',
    timeout: "30000" // global timeout 30 seconds

});

// namespace for api
var mox = {
    refreshing: false,
    contextData: {
        users: {},
        groups: {},
        resources: {}
    },
    product: {
        id:             "com.openexchange.mobileapp",
        version:        "@version@",
        pversion:       "@pversion@",
        product_name:   "Open-Xchange Mobile Web Interface",
        vendor_name:    "Open-Xchange AG",
        vendor_address: "Rollnerstra&szlig;e 14\nD-90409 N&uuml;rnberg\nE-Mail: info@open-xchange.com"
    }
};

// default values
var localUserConfig = {
    user: "",
    lang: "",
    autoLogin: false,
    subscribedFolders: {
        contacts: [],
        mail: [],
        calendar: []
    },
    folderTree : {
        contactFolders: [],
        contactsCount: [],
        mailFolders: [],
        calendarFolders: []
    },
    appointmentDays: 14,
    storage: {
        contactStorageList: [],
        appointmentsStorageList: [],
        mailStorageList: []
    }
};

var unreadMails = {
    //returns sum of all unread mails
    all: function(priv) {
        priv = priv || false;
        var k = 0;
        $.each(unreadMails, function(e, item) {
            if (typeof(item) === "number") {
                if (mox.mail.isCountFolder(e, priv) === true) {
                    k += item;
                }
            }
        });
        return k;
    },
    //returns sum of private unread mails
    allPrivate: function() {
        return this.all(true);
    }
};



/**
 * 
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 * 
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * 
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com 
 * 
 * @author Viktor Pracht <viktor.pracht@open-xchange.com>
 * 
 */

emptyFunction = function(){};
/**
 * A class for translated strings.
 * Each I18n object has a toString() method which returns the translation based
 * on the current language. All user-visible widgets expect instances of this
 * class, and convert them to strings when the user changes the GUI language.
 * @param {function()} toString A callback function which returns a translated
 * text using the current GUI language.
 */
function I18nString(toString) { this.toString = toString; }
I18nString.prototype = new String();
I18nString.prototype.valueOf = function() { return this.toString(); };
// TODO print warnings if one of the inherited methods is used.

/**
 * Translates a string
 * @function
 * @param {String} text The original English text to translate.
 * @type I18nString
 * @return The translated text.
 * @ignore
 */
var _i18n;

/**
 * Converts a string to a translated string without translation.
 * Use only for user-entered data.
 * @param {String} text The text which should not be translated.
 * @type I18nString
 * @return The text as an I18nString object.
 */
var noI18n;

/**
 * Translates a string
 * @function
 * @param {String} text The original English text to translate.
 * @type I18nString
 * @return The translated text.
 * @ignore
 */
var gettext;

/**
 * Translates a string
 * @function
 * @param {String} context A context to differentiate multiple identical texts
 * with different translations.
 * @param {String} text The original English text to translate.
 * @type I18nString
 * @return The translated text.
 * @ignore
 */
var pgettext;

/**
 * Translates a string
 * @function
 * @param {String} domain An i18n domain to use for the translation.
 * @param {String} context A context to differentiate multiple identical texts
 * with different translations.
 * @param {String} text The original English text to translate.
 * @type I18nString
 * @return The translated text.
 */
var dpgettext;

/**
 * Translates a string containing numbers.
 * @function
 * @param {String} singular The original English text for the singular form.
 * @param {String} plural The original English text for the plural form.
 * @param {Number} n The number which determines which text form is used.
 * @param {String} context An optional context to differentiate multiple
 * identical texts with different translations.
 * @param {String} domain An optional i18n domain to use for the translation.
 * @type I18nString
 * @return The translated text.
 * @ignore
 */
var ngettext;

/**
 * Translates a string containing numbers.
 * @function
 * @param {String} context A context to differentiate multiple identical texts
 * with different translations.
 * @param {String} singular The original English text for the singular form.
 * @param {String} plural The original English text for the plural form.
 * @param {Number} n The number which determines which text form is used.
 * @type I18nString
 * @return The translated text.
 * @ignore
 */
var npgettext;

/**
 * Translates a string containing numbers.
 * @function
 * @param {String} domain An i18n domain to use for the translation.
 * @param {String} context A context to differentiate multiple identical texts
 * with different translations.
 * @param {String} singular The original English text for the singular form.
 * @param {String} plural The original English text for the plural form.
 * @param {Number} n The number which determines which text form is used.
 * @type I18nString
 * @return The translated text.
 */
var dnpgettext;

/**
 * Adds a new i18n domain, usually for a plugin.
 * @function
 * @param {String} domain A new domain name, usually the plugin name.
 * @param {String} pattern A Pattern which is used to find the PO or JS file on
 * the server. The pattern is processed by formatting it with the language ID
 * as the only parameter. The formatted result is used to download the file
 * from the server.
 */
var bindtextdomain;

/**
 * Changes the current language which is used for all subsequent translations.
 * Also translates all currently displayed strings.
 * @function
 * @param {String} name The ID of the new language.
 */
var setLanguage;

/**
 * Returns the translation dictionary for the specified language.
 * @private
 * @function
 * @param {String} name The language ID of the dictionary to return.
 * @type Object
 * @return The translation dictionary of the specified language.
 */
var getDictionary;

/**
 * Returns an array with currently registered i18n domains. I18n domains are
 * used by plugins to allow for independent translation.
 * @function
 * @type Array
 * @return An array of strings, including one empty string for the default
 * domain.
 */
var listI18nDomains;

/**
 * Installs a PO file from a string parameter instead of downloading it from
 * the server.
 * In case of a syntax error, an exception is thrown.
 * If the specified language file is already loaded, it will be replaced.
 * When replacing a file for the currently active language, the settings take
 * effect immediately.
 * @function
 * @param {String} domain The i18n domain of the file. Usually the ID of
 * a plugin or the empty string for the translation of the core.
 * @param {String} language The language of the file.
 * @param {String} data The contents of the PO file.
 */
var replacePOFile;

/**
 * Formats a string by replacing printf-style format specifiers in the string
 * with dynamic parameters. Flags, width, precision and length modifiers are
 * not supported. All type conversions are performed by the standard toString()
 * JavaScript method.
 * @param {String or I18nString} string The format string.
 * @param params Either an array with parameters or multiple separate
 * parameters.
 * @type String or I18nString
 * @return The formatted string.
 */
function format(string, params) {
	var param_array = params;
	if (Object.prototype.toString.call(params) != "[object Array]") {
		param_array = new Array(arguments.length - 1);
		for (var i = 1; i < arguments.length; i++)
			param_array[i - 1] = arguments[i];
	}
    if (string instanceof I18nString) {
        return new I18nString(function() {
            return formatRaw(string, param_array);
        });
    } else {
        return formatRaw(string, param_array);
    }
}

/**
 * @private
 * Formats a string by replacing printf-style format specifiers in the string
 * with dynamic parameters. Flags, width, precision and length modifiers are
 * not supported. All type conversions (except from I18nString) are performed
 * by the standard toString() JavaScript method.
 * @param {String} string The format string.
 * @param params An array with parameters.
 * @type String
 * @return The formatted string.
 * @ignore
 */
function formatRaw(string, params) {
    var index = 0;
    return String(string).replace(/%(([0-9]+)\$)?[A-Za-z]/g,
        function(match, pos, n) {
            if (pos) index = n - 1;
            return params[index++];
        }).replace(/%%/, "%");
}

/**
 * Formats and translates an error returned by the server.
 * @param {Object} result the JSON object as passed to a JSON callback function.
 * @param {String} formatString an optional format string with the replacement
 * parameters <dl><dt>%1$s</dt><dd>the error code,</dd>
 * <dt>%2$s</dt><dd>the fomratter error message,</dd>
 * <dt>%3$s</dt><dd>the unique error ID.</dd></dl>
 * @type String
 * @returns the formatted and translated error message.
 * @ignore
 */
function formatError(result, formatString) {
	//#. %1$s is the error code.
	//#. %2$s is the formatted error message.
    //#. %3$s is the unique error ID.
	//#, c-format
	return format(formatString || _i18n("Error: %2$s (%1$s, %3$s)"), result.code,
                  format(_i18n(result.error), result.error_params),
                  result.error_id);
}

/**
 * Utility function which checks for untranslated strings.
 * Should be used by widget implementations to convert I18nString to strings
 * immediately before displaying them.
 * @param {I18nString} text The translated text.
 * @type String
 * @return The current translation of the text as a string.
 */
/*
function expectI18n(text) {
    expectI18n = debug ? function(text) {
        if (!(text instanceof I18nString)) {
            _.debug("Untranslated text:",
                typeof text == "function" ? text() : text, getStackTrace());
        }
        return String(text);
    } : String;
    return expectI18n(text);
}
*/
var current_lang;
(function() {
    var current; //current_lang;
    var domains = { "": "lang/%s.po" };
    var languages = {};
    var originals = {};
	var counter = 0;

	_i18n = gettext = function(text) { return dpgettext("", "", text); };
	
	noI18n = function(text) { return new I18nString(constant(text)); };
    
    pgettext = function(context, text) { return dpgettext("", context, text); };
    
    function dpgettext_(domain, context, text) {
        return new I18nString(function() {
            var c = current && current[domain || ""];
            var key = context ? context + "\0" + text : text;
            return c && c.dictionary[key] || text;
        });
    }
    dpgettext = function() {
        dpgettext = debug ? function(domain, context, text) {
            if (text instanceof I18nString) {
                _.debug("Retranslation", text);
            }
            return dpgettext_.apply(this, arguments);
        } : dpgettext_;
        return dpgettext.apply(this, arguments);
    };
    
    ngettext = function(singular, plural, n) {
        return dnpgettext("", "", singular, plural, n);
    };

	npgettext = function(context, singular, plural, n) {
        return dnpgettext("", context, singular, plural, n);
    };
    
    dnpgettext = function(domain, context, singular, plural, n) {
		var text = n != 1 ? plural : singular;
		return new I18nString(function() {
            var c = current && current[domain || ""];
            if (!c) return text;
            var key = context ?
                [context, "\0", singular, "\x01", plural].join("") :
                [               singular, "\x01", plural].join("");
    		var translation = c.dictionary[key];
    		if (!translation) return text;
    		return translation[Number(c.plural(n))] || text;
		});
	};

    function parse(pattern, file) {
        if (pattern.substring(pattern.length - 2) == "po") {
            return parsePO(file);
        } else {
            return (new Function("return " + file))();
        }
    }
    
    bindtextdomain = function(domain, pattern, cont) {
        domains[domain] = pattern;
        if (languages[current_lang] === current) {
            //setLanguage(current_lang, cont);
        } else {
            if (cont) { cont(); }
        }
    };
    
    listI18nDomains = function() {
        var result = [];
        for (var i in domains) result.push(i);
        return result;
    };
    
    replacePOFile = function(domain, language, data) {
        if (!languages[language]) languages[language] = {};
        languages[language][domain] = parsePO(data);
        if (language == current_lang) setLanguage(current_lang);
    };

	setLanguage = function (name, cont) {
        current_lang = name;
        var new_lang = languages[name];
		if (!new_lang) {
            loadLanguage(name, cont);
            return;
        }
        for (var i in domains) {
            if (!(i in new_lang)) {
                loadLanguage(name, cont);
                return;
            }
        }
		current = new_lang;
		/*
		for (var i in init.i18n) {
			var attrs = init.i18n[i].split(",");
			var node = $(i);
			if(node) {
				for (var j = 0; j < attrs.length; j++) {
					var attr = attrs[j];
					var id = attr + "," + i;
					var text = attr ? node.getAttributeNode(attr)
					                : node.firstChild;
                    var val = text && String(text.nodeValue);
					if (!val || val == "\xa0" )
                        alert(format('Invalid i18n for id="%s"', i));
					var original = originals[id];
					if (!original) original = originals[id] = val;
                    var context = "";
                    var pipe = original.indexOf("|");
                    if (pipe >= 0) {
                        context = original.substring(0, pipe);
                        original = original.substring(pipe + 1);
                    }
					text.nodeValue = dpgettext("", context, original);
				}
			}
		}*/
        //triggerEvent("LanguageChangedInternal");
        updateFormats();
		languageChanged();
		if (cont) { cont(name); }
        
    };
/*
    function loadLanguage(name, cont) {
	var curr = languages[name];
        if (!curr) curr = languages[name] = {};
        var join = new Join(function() { setLanguage(name, cont); });
        var lock = join.add();
        for (var d in domains) {
            if (!(d in curr)) {
            	// get file name
            	var file = format(domains[d], name);
            	// add pre-compression (specific languages only)
            	//file = file.replace(/(de_DE|en_GB|en_US)\.js/, "$1.jsz");
            	// inject version
            	//var url = urlify(file);
            	var url = file;
                // get language file
            	util.GET({
            	    //async: false,
                    url: url,
                    success: join.add((function(domain) {
                        return function(file) {
                            try {
                               
                                languages[name][domain] = parse(domains[domain], file);
                            } catch (e) {
                              
                                _.debug("Error loading PO file",e);
                                join.add(); // prevent setLanguage()
                            }
                        };
                    })(d)),
                    error: join.alt((function(domain) {
                        return function(result, status) {
                         
                            languages[name][domain] = false;
                            return status == 404;
                        };
                    })(d))
                });

            }
		}
        lock();
	}
	
	getDictionary = function(name) { return languages[name]; };	

})();
*/
loadOnce = (function () {
        
        var pending = {};
        
        var process = function (url, type, args) {
            // get callbacks
            var list = pending[url][type], i = 0, $i = list.length;
            // loop
            for (; i < $i; i++) {
                // call back
                if (list[i]) {
                    list[i].apply(window, args || []);
                }
            }
            list = null;
            delete pending[url];
        };
        
        return function (url, success, error) {
            
            if (pending[url] === undefined) {
                // mark as pending
                pending[url] = { success: [success], error: [error] };
                // load file
                util.GET({
                    url: url,
                    success: function () {
                        // success!
                        process(url, "success", arguments);
                    },
                    error: function () {
                        // error!
                        process(url, "error", arguments);
                    }
                });
            } else {
                // enqueue
                pending[url].success.push(success);
                pending[url].error.push(error);
            }
        };
        
    }());
    
    function loadLanguage(name, cont) {
       
        var curr = languages[name];
        if (!curr) curr = languages[name] = {};
        var join = new Join(function() { setLanguage(name, cont); });
        var lock = join.add();
        for (var d in domains) {
            if (!(d in curr)) {
                // get file name
                var file = format(domains[d], name);
                // add pre-compression (specific languages only)
                file = file.replace(/(de_DE|en_GB|en_US)\.js/, "$1.jsz");
                // inject version
                var url = file;
                // get language file (once!)
                loadOnce(
                    url,
                    // success
                    join.add((function(domain) {
                        return function(file) {
                            try {
                                languages[name][domain] = parse(domains[domain], file);
                            } catch (e) {
                                // language could not be loaded, perhaps broken po
                                _.debug(e);
                                mox.error.newError("error loading po " + e);
                                join.add(); // prevent setLanguage()
                            }
                        };
                    })(d)),
                    // error
                    join.alt((function(domain) {
                        return function(xhr) {
                            languages[name][domain] = false;
                            return String(xhr.status) === "404";
                        };
                    })(d))
                );
            }
        }
        lock();
    }
    
    getDictionary = function(name) { return languages[name]; }; 

})();

function parsePO(file) {
    parsePO.tokenizer.lastIndex = 0;
    var line_no = 1;
    
    function next() {
        while (parsePO.tokenizer.lastIndex < file.length) {
            var t = parsePO.tokenizer.exec(file);
            if (t[1]) continue;
            if (t[2]) {
                line_no++;
                continue;
            }
            if (t[3]) return t[3];
            if (t[4]) return t[4];
            if (t[5]) throw new Error(format(
                "Invalid character in line %s.", line_no));
        }
    }

    var lookahead = next();

    function clause(name, optional) {
        if (lookahead == name) {
            lookahead = next();
            var parts = [];
            while (lookahead && lookahead.charAt(0) == '"') {
                parts.push((new Function("return " + lookahead))());
                lookahead = next();
            }
            return parts.join("");
        } else if (!optional) {
            throw new Error(format(
                "Unexpected '%1$s' in line %3$s, expected '%2$s'.",
                lookahead, name, line_no));
        }
    }
    
    if (clause("msgid") != "") throw new Error("Missing PO file header");
    var header = clause("msgstr");
    if (parsePO.headerRegExp.exec(header)) {
        var po = (new Function("return " + header.replace(parsePO.headerRegExp,
            "{ nplurals: $1, plural: function(n) { return $2; }, dictionary: {} }"
            )))();
    } else {
        var po = { nplurals: 1, plural: function(n) { return 0; },
                   dictionary: {} };
    }
    while (lookahead) {
        var ctx = clause("msgctxt", true);
        var id = clause("msgid");
        var id_plural = clause("msgid_plural", true);
        var str;
        if (id_plural !== undefined) {
            id = id += "\x01" + id_plural;
            str = {};
            for (var i = 0; i < po.nplurals; i++) {
                str[i] = clause("msgstr[" + i + "]");
            }
        } else {
            str = clause("msgstr");
        }
        if (ctx) id = ctx + "\0" + id;
        po.dictionary[id] = str;
    }
    return po;
}

parsePO.tokenizer = new RegExp(
    '^(#.*|[ \\t\\v\\f]+)$' +                  // comment or empty line
    '|(\\r\\n|\\r|\\n)' +                      // linebreak (for line numbering)
    '|^(msg[\\[\\]\\w]+)(?:$|[ \\t\\v\\f]+)' + // keyword
    '|[ \\t\\v\\f]*(".*")\\s*$' +              // string
    '|(.)',                                    // anything else is an error
    "gm");

parsePO.headerRegExp = new RegExp(
    '^(?:[\\0-\\uffff]*\\n)?' +                         // ignored prefix
    'Plural-Forms:\\s*nplurals\\s*=\\s*([0-9]+)\\s*;' + // nplurals
                 '\\s*plural\\s*=\\s*([^;]*);' +        // plural
    '[\\0-\\uffff]*$'                                   // ignored suffix
);

/**
 * Encapsulation of a single translated text node which is created at runtime.
 * @param {Function} callback A function which is called as a method of
 * the created object and returns the current translated text.
 * @param {Object} template An optional object which is used for the initial
 * translation. All enumerable properties of the template will be copied to
 * the newly created object before the first call to callback.
 *
 * Fields of the created object:
 *
 * node: The DOM text node which is automatically translated.
 * @ignore
 */
function I18nNode(callback, template) {
    if (template) for (var i in template) this[i] = template[i];
    if (callback instanceof I18nString) {
        this.callback = function() { return String(callback); };
    } else {
        if (typeof callback != "function") {
            if (debug) {
                _.debug("Untranslated string:", callback, getStackTrace());
            }
            this.callback = function() { return _i18n(callback); };
        } else {
            if (debug) {
                _.debug("Untranslated string:", callback(),
                             getStackTrace());
            }
            this.callback = callback;
        }
    }
    this.index = ++I18nNode.counter;
	this.node = document.createTextNode(this.callback());
	this.enable();
}

I18nNode.prototype = {
	/**
	 * Updates the node contents. Is called whenever the current language
	 * changes and should be also called when the displayed value changes.
	 * @ignore
     */
	update: function() {
        if (typeof this.callback != "function") {
            _.debug(format(
                "The callback \"%s\" has type \"%s\".",
                this.callback, typeof this.callback));
        } else {
/**#nocode+*/
            this.node.data = this.callback();
/**#nocode-*/
        }
    },
	
	/**
	 * Disables automatic updates for this object.
	 * Should be called when the text node is removed from the DOM tree.
     * @ignore
	 */
	disable: function() { delete I18nNode.nodes[this.index]; },
	
	/**
	 * Reenables previously disabled updates.
     * @ignore
	 */
 	enable: function() { I18nNode.nodes[this.index] = this; }
};

I18nNode.nodes = {};
I18nNode.counter = 0;

function languageChanged() {
	for (var i in I18nNode.nodes) {
        I18nNode.nodes[i].update();
    }
    //i18nInit.writei18nTags();
}

/**
 * Creates an automatically updated node from a static text. The node can not
 * be removed.
 * @param {I18nString} text The text to be translated. It must be marked with
 * the <code>&#57;*i18n*&#57;</code> comment.
 * @param {String} context An optional context to differentiate multiple
 * identical texts with different translations. It must be marked with
 * the <code>&#57;*i18n context*&#57;</code> comment.
 * @param {String} domain An optional i18n domain to use for the translation.
 * @type Object
 * @return The new DOM text node.
 * @ignore
 */
function addTranslated(text, context, domain) {
	return (new I18nNode(text instanceof I18nString ? text :
	    dpgettext(domain, context, text))).node;
}

/**
 * Returns whether a date is today.
 * @param utc The date. Any valid parameter to new Date() will do.
 * @type Boolean
 * @return true if the parameter has today's date, false otherwise.
 * @ignore
 */
function isToday(utc) {
    var today = new Date(now());
    today.setUTCHours(0, 0, 0, 0);
    var diff = (new Date(utc)).getTime() - today.getTime();
    return diff >= 0 && diff < 864e5; // ms/day
}

/**
 * The first week with at least daysInFirstWeek days in a given year is defined
 * as the first week of that year.
 * @ignore
 */
var daysInFirstWeek = 4;

/**
 * First day of the week.
 * 0 = Sunday, 1 = Monday and so on.
 * @ignore
 */
var weekStart = 1;

function getDays(d) { return Math.floor(d / 864e5); }

/**
 * Computes the week number of the specified Date object, taking into account
 * daysInFirstWeek and weekStart.
 * @param {Date} d The date for which to calculate the week number.
 * @param {Boolean} inMonth True to compute the week number in a month,
 * False for the week number in a year 
 * @type Number
 * @return Week number of the specified date.
 * @ignore
 */
function getWeek(d, inMonth) {
	var keyDay = getKeyDayOfWeek(d);
	var keyDate = new Date(keyDay * 864e5);
	var jan1st = Date.UTC(keyDate.getUTCFullYear(),
	                      inMonth ? keyDate.getUTCMonth() : 0);
	return Math.floor((keyDay - getDays(jan1st)) / 7) + 1;
}
 
/**
 * Returns the day of the week which decides the week number
 * @return Day of week
 */
function getKeyDayOfWeek(d) {
	var firstDay = getDayInSameWeek(d, weekStart);
	return (firstDay + 7 - daysInFirstWeek);
}

/**
 * Computes the number of the first day of the specified week, taking into
 * account weekStart.
 * @param  {Date} d The date for which to calculate the first day of week number.
 * type Number
 * @return First day in the week as the number of days since 1970-01-01.
 * @ignore
 */
function getDayInSameWeek(d, dayInWeek) {
	return getDays(d.getTime()) - (d.getUTCDay() - dayInWeek + 7) % 7; 
}

function getDaysInMonth (month, year) {
    var dd = new Date(year, month, 0);
    return dd.getDate();
};

/**
 * Formats a Date object according to a format string.
 * @function
 * @param {String} format The format string. It has the same syntax as Java's
 * java.text.SimpleDateFormat, assuming a Gregorian calendar.
 * @param {Date} date The Date object to format. It must contain a Time value as
 * defined in the HTTP API specification.
 * @type String
 * @return The formatted date and/or time.
 */
var formatDateTime;

/**
 * Parses a date and time according to a format string.
 * @function
 * @param {String} format The format string. It has the same syntax as Java's
 * java.text.SimpleDateFormat, assuming a Gregorian calendar.
 * @param {String} string The string to parse.
 * @type Date
 * @return The parsed date as a Date object. It will contain a Time value as
 * defined in the HTTP API specification.
 */
var parseDateTime;

/**
 * An array with translated week day names.
 * @ignore
 */
var weekdays = [];

(function() {

    var regex = /(G+|y+|M+|w+|W+|D+|d+|F+|E+|a+|H+|k+|K+|h+|m+|s+|S+|z+|Z+)|\'(.+?)\'|(\'\')/g;

	function num(n, x) {
		var s = x.toString();
		n -= s.length;
		if (n <= 0) return s;
		var a = new Array(n);
		for (var i = 0; i < n; i++) a[i] = "0";
		a[n] = s;
		return a.join("");
	}
	function text(n, full, shrt) {
		return n >= 4 ? _i18n(full) : _i18n(shrt);
	}
	var months = [
		"January"/*i18n*/, "February"/*i18n*/,     "March"/*i18n*/,
		  "April"/*i18n*/,      "May"/*i18n*/,      "June"/*i18n*/,
		   "July"/*i18n*/,   "August"/*i18n*/, "September"/*i18n*/,
		"October"/*i18n*/, "November"/*i18n*/,  "December"/*i18n*/
	];
	var shortMonths = [
		"Jan"/*i18n*/, "Feb"/*i18n*/, "Mar"/*i18n*/, "Apr"/*i18n*/,
		"May"/*i18n*/, "Jun"/*i18n*/, "Jul"/*i18n*/, "Aug"/*i18n*/,
		"Sep"/*i18n*/, "Oct"/*i18n*/, "Nov"/*i18n*/, "Dec"/*i18n*/
	];
	var days = weekdays.untranslated = [
		   "Sunday"/*i18n*/,   "Monday"/*i18n*/, "Tuesday"/*i18n*/,
		"Wednesday"/*i18n*/, "Thursday"/*i18n*/,  "Friday"/*i18n*/,
		 "Saturday"/*i18n*/
	];
	var shortDays = [
		"Sun"/*i18n*/, "Mon"/*i18n*/, "Tue"/*i18n*/, "Wed"/*i18n*/,
		"Thu"/*i18n*/, "Fri"/*i18n*/, "Sat"/*i18n*/
	];
	var funs = {
		G: function(n, d) {
			return d.getTime() < -62135596800000 ? _i18n("BC") : _i18n("AD");
		},
		y: function(n, d) {
			var y = d.getUTCFullYear();
			if (y < 1) y = 1 - y;
			return num(n, n == 2 ? y % 100 : y);
		},
		M: function(n, d) {
			var m = d.getUTCMonth();
			if (n >= 3) {
				return text(n, months[m], shortMonths[m]);
			} else {
				return num(n, m + 1);
			}
		},
		w: function(n, d) { return num(n, getWeek(d)); },
		W: function(n, d) { return num(n, getWeek(d, true)); },
		D: function(n, d) {
			return num(n,
				getDays(d.getTime() - Date.UTC(d.getUTCFullYear(), 0)) + 1);
		},
		d: function(n, d) { return num(n, d.getUTCDate()); },
		F: function(n, d) {
			return num(n, Math.floor(d.getUTCDate() / 7) + 1);
		},
		E: function(n, d) {
			var m = d.getUTCDay();
			return text(n, days[m], shortDays[m]);
		},
		a: function(n, d) {
            return d.getUTCHours() < 12 ? _i18n("AM") : _i18n("PM");
        },
		H: function(n, d) { return num(n, d.getUTCHours()); },
		k: function(n, d) { return num(n, d.getUTCHours() || 24); },
		K: function(n, d) { return num(n, d.getUTCHours() % 12); },
		h: function(n, d) { return num(n, d.getUTCHours() % 12 || 12); },
		m: function(n, d) { return num(n, d.getUTCMinutes()); },
		s: function(n, d) { return num(n, d.getUTCSeconds()); },
		S: function(n, d) { return num(n, d.getMilliseconds()); },
        // TODO: z and Z 
		z: function() { return ""; },
		Z: function() { return ""; }
	};
	formatDateTime = function(format, date) {
        return format instanceof I18nString ? new I18nString(fmt) : fmt();
	    function fmt() {
            return String(format).replace(regex,
                function(match, fmt, text, quote) {
                    if (fmt) {
                        return funs[fmt.charAt(0)](fmt.length, date);
                    } else if (text) {
                        return text;
                    } else if (quote) {
                        return "'";
                    }
                });
	    }
	};
    
    var f = "G+|y+|M+|w+|W+|D+|d+|F+|E+|a+|H+|k+|K+|h+|m+|s+|S+|z+|Z+";
    var pregexStr = "(" + f + ")(?!" + f + ")|(" + f + ")(?=" + f +
        ")|\'(.+?)\'|(\'\')|([$^\\\\.*+?()[\\]{}|])";
    var pregex = new RegExp(pregexStr, "g");
    
    var monthRegex;
    var monthMap;
    function recreateMaps() {
        var names = months.concat(shortMonths);
        for (var i = 0; i < names.length; i++) names[i] = escape(_i18n(names[i]));
        monthRegex = "(" + names.join("|") + ")";
        monthMap = {};
        for (var i = 0; i < months.length; i++) {
            monthMap[_i18n(months[i])] = i;
            monthMap[_i18n(shortMonths[i])] = i;
        }
        weekdays.length = days.length;
        for (var i = 0; i < days.length; i++) weekdays[i] = _i18n(days[i]);
    }
    recreateMaps();
    
    
    function escape(rex) {
        return String(rex).replace(/[$^\\.*+?()[\]{}|]/g, "\\$");
    }

    var numRex = "([+-]?\\d+)";
    function number(n) { return numRex; }
        
    var prexs = {
        G: function(n) {
            return "(" + escape(_i18n("BC")) + "|" + escape(_i18n("AD")) + ")";
        },
        y: number,
        M: function(n) { return n >= 3 ? monthRegex : numRex; },
        w: number, W: number, D: number, d: number, F: number, E: number,
        a: function(n) {
            return "(" + escape(_i18n("AM")) + "|" + escape(_i18n("PM")) + ")";
        },
        H: number, k: number, K: number, h: number, m: number, s: number,
        S: number
        // TODO: z and Z
    };
    
    function mnum(n) {
        return n > 1 ? "([+-]\\d{1," + (n - 1) + "}|\\d{1," + n + "})"
                     :                           "(\\d{1," + n + "})"; }
    
    var mrexs = {
        G: prexs.G, y: mnum,
        M: function(n) { return n >= 3 ? monthRegex : mnum(n); },
        w: mnum, W: mnum, D: mnum, d: mnum, F: mnum, E: prexs.E, a: prexs.a,
        H: mnum, k: mnum, K: mnum, h: mnum, m: mnum, s: mnum, S: mnum
        // TODO: z and Z
    };
    
    var pfuns = {
        G: function(n) { return function(s, d) { d.bc = s == _i18n("BC"); }; },
        y: function(n) {
            return function(s, d) {
                d.century = n <= 2 && s.match(/^\d\d$/);
                d.y = s;
            };
        },
        M: function(n) {
            return n >= 3 ? function (s, d) { d.m = monthMap[s]; }
                          : function(s, d) { d.m = s - 1; };
        },
        w: emptyFunction, W: emptyFunction, D: emptyFunction,
        d: function(n) { return function(s, d) { d.d = s }; },
        F: emptyFunction, E: emptyFunction,
        a: function(n) { return function(s, d) { d.pm = s == _i18n("PM"); }; },
        H: function(n) { return function(s, d) { d.h = s; }; },
        k: function(n) { return function(s, d) { d.h = s == 24 ? 0 : s; }; },
        K: function(n) { return function(s, d) { d.h2 = s; }; },
        h: function(n) { return function(s, d) { d.h2 = s == 12 ? 0 : s; }; },
        m: function(n) { return function(s, d) { d.min = s; }; },
        s: function(n) { return function(s, d) { d.s = s; }; },
        S: function(n) { return function(s, d) { d.ms = s; }; }
        // TODO: z and Z
    };
    
    var threshold = new Date();
    var century = Math.floor((threshold.getUTCFullYear() + 20) / 100) * 100;
    
    parseDateTime = function(formatMatch, string) {
        var handlers = [];
        var rex = formatMatch.replace(pregex,
            function(match, pfmt, mfmt, text, quote, escape) {
                if (pfmt) {
                    handlers.push(pfuns[pfmt.charAt(0)](pfmt.length));
                    return prexs[pfmt.charAt(0)](pfmt.length);
                } else if (mfmt) {
                    handlers.push(pfuns[mfmt.charAt(0)](mfmt.length));
                    return mrexs[mfmt.charAt(0)](mfmt.length);
                } else if (text) {
                    return text;
                } else if (quote) {
                    return "'";
                } else if (escape) {
                    return "\\" + escape;
                }
            });
        var match = string.match(new RegExp("^\\s*" + rex + "\\s*$", "i"));
        if (!match) return null;
        var d = { bc: false, century: false, pm: false,
            y: 1970, m: 0, d: 1, h: 0, h2: 0, min: 0, s: 0, ms: 0 };
        for (var i = 0; i < handlers.length; i++)
            handlers[i](match[i + 1], d);
        if (d.century) {
            d.y = Number(d.y) + century;
            var date = new Date(0);
            date.setUTCFullYear(d.y - 20, d.m, d.d);
            date.setUTCHours(d.h, d.min, d.s, d.ms);
            if (date.getTime() > threshold.getTime()) d.y -= 100;
        }
        if (d.bc) d.y = 1 - d.y;
        if (!d.h) d.h = Number(d.h2) + (d.pm ? 12 : 0);
        var date = new Date(0);
        date.setUTCFullYear(d.y, d.m, d.d);
        date.setUTCHours(d.h, d.min, d.s, d.ms);
        return date;
    };

})();

/**
 * Format UTC into human readable date and time formats
 * @function
 * @param {Date} date The date and time as a Date object.
 * @param {String} format A string which selects one of the following predefined
 * formats: <dl>
 * <dt>date</dt><dd>only the date</dd>
 * <dt>time</dt><dd>only the time</dd>
 * <dt>datetime</dt><dd>date and time</dd>
 * <dt>dateday</dt><dd>date with the day of week</dd>
 * <dt>hour</dt><dd>hour (big font) for timescales in calendar views</dd>
 * <dt>suffix</dt><dd>suffix (small font) for timescales in calendar views</dd>
 * <dt>onlyhour</dt><dd>2-digit hour for timescales in team views</dd></dl>
 * @type String
 * @return The formatted string
 * @ignore
 */
var formatDate;

/**
 * Parse human readable date and time formats
 * @function
 * @param {String} string The string to parse
 * @param {String} format A string which selects one of the following predefined
 * formats:<dl>
 * <dt>date</dt><dd>only the date</dd>
 * <dt>time</dt><dd>only the time</dd></dl>
 * @type Date
 * @return The parsed Date object or null in case of errors.
 * @ignore
 */
var parseDateString;
var updateFormats;
(function() {
    var formats;
    updateFormats = function() {
        var date_def = false; //configGetKey("gui.global.region.date.predefined") != 0;
        var time_def = false; // configGetKey("gui.global.region.time.predefined") != 0;
        //var date = date_def ? _("yyyy-MM-dd")
     //                       : configGetKey("gui.global.region.date.format");
        var time = _i18n("HH:mm");
     //                       : configGetKey("gui.global.region.time.format");
        var hour = false; //configGetKey("gui.global.region.time.format_hour");
        var suffix = false; //configGetKey("gui.global.region.time.format_suffix");
        var date = _i18n("yyyy-MM-dd");
        var time = _i18n("HH:mm");
        formats = {
            date: date,
            time: time,
            //#. Short date format (month and day only)
            //#. MM is month, dd is day of the month
            shortdate: _i18n("MM/dd"),
            //#. The relative position of date and time.
            //#. %1$s is the date
            //#. %2$s is the time
            //#, c-format
            datetime: format(pgettext("datetime", "%1$s %2$s"), date, time),
            //#. The date with the day of the week.
            //#. EEEE is the full day of the week,
            //#. EEE is the short day of the week,
            //#. %s is the date.
            //#, c-format
            dateday: format(_i18n("EEEE, %s"), date),
            //#. The date with the day of the week.
            //#. EEEE is the full day of the week,
            //#. EEE is the short day of the week,
            //#. %s is the date.
            //#, c-format
            dateshortday: format(_i18n("EEE, %s"), date),
            dateshortdayreverse: format(_i18n("%s, EEE"), date),
            //#. The format for calendar timescales
            //#. when the interval is at least one hour.
            //#. H is 1-24, HH is 01-24, h is 1-12, hh is 01-12, a is AM/PM,
            //#. mm is minutes.
            hour: time_def ? pgettext("dayview", "HH:mm") : hour,
            //#. The format for hours on calendar timescales
            //#. when the interval is less than one hour.
            prefix: time_def ? pgettext("dayview", "HH") : suffix ? "hh" : "HH",
            //#. The format for minutes on calendar timescales
            //#. when the interval is less than one hour.
            //#. 12h formats should use AM/PM ("a").
            //#. 24h formats should use minutes ("mm").
            suffix: time_def ? pgettext("dayview", "mm") : suffix ? "a" : "mm",
            //#. The format for team view timescales
            //#. HH is 01-24, hh is 01-12, H is 1-24, h 1-12, a is AM/PM
            onlyhour: time_def ? pgettext("teamview", "H") : suffix ? "ha" : "H"
        };
    }
    updateFormats();
    /*
    register("LanguageChangedInternal", updateFormats);
    register("OX_Configuration_Changed", updateFormats);
    register("OX_Configuration_Loaded", updateFormats);
    */
    formatDate = function(date, format) {
        return formatDateTime(formats[format], new Date(date));
    };    

    parseDateString = function(string, format) {
        return parseDateTime(formats[format || "date"].replace("yyyy","yy"), string);
    };

})();

function formatNumbers(value,format_language) {
	var val;
	if(!format_language) {
		format_language=configGetKey("language");
	}
	switch(format_language) {
		case "en_US":
			return value;
			break;
		default:
			val = String(value).replace(/\./,"\,");
			return val;
			break;
	}
}

function round(val) {
	val = formatNumbers(Math.round(parseFloat(String(val).replace(/\,/,"\.")) * 100) / 100);
	return val;
}

/**
 * Formats an interval as a string
 * @param {Number} t The interval in milliseconds
 * @param {Boolean} until Specifies whether the returned text should be in
 * objective case (if true) or in nominative case (if false).
 * @type String
 * @return The formatted interval.
 */
function getInterval(t, until) {
    function minutes(m) {
        return format(until
            //#. Reminder (objective case): in X minutes
            //#. %d is the number of minutes
            //#, c-format
            ? npgettext("in", "%d minute", "%d minutes", m)
            //#. General duration (nominative case): X minutes
            //#. %d is the number of minutes
            //#, c-format
            :  ngettext("%d minute", "%d minutes", m),
            m);
    }
    function get_h(h) {
        return format(until
            //#. Reminder (objective case): in X hours
            //#. %d is the number of hours
            //#, c-format
            ? npgettext("in", "%d hour", "%d hours", h)
            //#. General duration (nominative case): X hours
            //#. %d is the number of hours
            //#, c-format
            :  ngettext(      "%d hour", "%d hours", h),
            h);
    }
    function get_hm(h, m) {
        return format(until
            //#. Reminder (objective case): in X hours and Y minutes
            //#. %1$d is the number of hours
            //#. %2$s is the text for the remainder of the last hour
            //#, c-format
            ? npgettext("in", "%1$d hour and %2$s", "%1$d hours and %2$s", h)
            //#. General duration (nominative case): X hours and Y minutes
            //#. %1$d is the number of hours
            //#. %2$s is the text for the remainder of the last hour
            //#, c-format
            :  ngettext("%1$d hour and %2$s", "%1$d hours and %2$s", h),
            h, minutes(m));
    }
    function hours(t) {
        if (t < 60) return minutes(t); // min/h
        var h = Math.floor(t / 60);
        var m = t % 60;
        return m ? get_hm(h, m) : get_h(h);
    }
    function get_d(d) {
        return format(until
            //#. Reminder (objective case): in X days
            //#. %d is the number of days
            //#, c-format
            ? npgettext("in", "%d day", "%d days", d)
            //#. General duration (nominative case): X days
            //#. %d is the number of days
            //#, c-format
            : ngettext("%d day", "%d days", d),
            d);
    }
    function get_dhm(d, t) {
        return format(until
            //#. Reminder (objective case): in X days, Y hours and Z minutes
            //#. %1$d is the number of days
            //#. %2$s is the text for the remainder of the last day
            //#, c-format
            ? npgettext("in", "%1$d day, %2$s", "%1$d days, %2$s", d)
            //#. General duration (nominative case): X days, Y hours and Z minutes
            //#. %1$d is the number of days
            //#. %2$s is the text for the remainder of the last day
            //#, c-format
            : ngettext("%1$d day, %2$s", "%1$d days, %2$s", d),
            d, hours(t));
    }
    function days(t) {
        if (t < 1440) return hours(t); // min/day
        var d = Math.floor(t / 1440);
        t = t % 1440;
        return t ? get_dhm(d, t) : get_d(d); 
    }
    function get_w(w) {
        return format(until
            //#. Reminder (objective case): in X weeks
            //#. %d is the number of weeks
            //#, c-format
            ? npgettext("in", "%d week", "%d weeks", w)
            //#. General duration (nominative case): X weeks
            //#. %d is the number of weeks
            //#, c-format
            : ngettext("%d week", "%d weeks", w),
            w);
    }

    t = Math.round(t / 60000); // ms/min
	if (t >= 10080 && t % 10080 == 0) { // min/week
        return get_w(Math.round(t / 10080));
	} else {
        return days(t);
    }
}

var currencies = [
            { iso: "CAD", name: "Canadian dollar", isoLangCodes: [ "CA" ] },
            { iso: "CHF", name: "Swiss franc", isoLangCodes: [ "CH" ] },
            { iso: "DKK", name: "Danish krone", isoLangCodes: [ "DK" ] },
            { iso: "EUR", name: "Euro", isoLangCodes: [ "AT", "BE", "CY", "FI", "FR", "DE", "GR", "IE", "IT", "LU", "MT", "NL", "PT", "SI", "ES" ] },
            { iso: "GBP", name: "Pound sterling", isoLangCodes: [ "GB" ] },
            { iso: "PLN", name: "Zloty", isoLangCodes: [ "PL" ] },
            { iso: "RUB", name: "Russian rouble", isoLangCodes: [ "RU" ] },
            { iso: "SEK", name: "Swedish krona", isoLangCodes: [ "SE" ] },
            { iso: "USD", name: "US dollar", isoLangCodes: [ "US" ] },
            { iso: "JPY", name: "Japanese Yen", isoLangCodes: [ "JP" ] }
        ];    

        

/**
 * Creates an object which calls the specified callback when multiple parallel
 * processes complete.
 * @param {Function} callback The callback which is called as a method of the
 * returned object when all parallel processes complete.
 */
function Join(callback) {
    //alert(callback.constructor.nativeCode);
    this.callback = callback;
    this.count = 0;
}

Join.prototype = {
    /**
     * Adds a parallel process by specifying a callback function which is called
     * when that process ends.
     * @param {Function} callback A callback function which should be called
     * when the process ends.
     * @type Function
     * @return A function which should be specified as callback instead of
     * the function specified as parameter.
     */
    add: function(callback) {
        this.count++;
        return this.alt(callback);
    },
    
    /**
     * Adds an alternative callback function to an existing parallel process.
     * @param {Function} callback A calback function which should be called
     * when the process ends.
     * @type Function
     * @return A function which should be specified as callback instead of
     * the function specified as parameter.
     */
    alt: function(callback) {
        var Self = this;        
        return function() {
            var retval;
            if (callback) retval = callback.apply(this, arguments);
            if (!--Self.count) Self.callback();
            return retval;      
        }
    }
};
/**
 * mox.init
 */
mox.init = {
    setLanguageTags : function(update) {
        // Loading message
        //$.mobile.loadingMessage = _i18n("Loading...").toString();

        /********** i18n ***************************************/
        // translate string included in tag as "data-i18n"

        if (update) {
            // special handling for checkbox field on login page
            $("body [data-i18n]:not(#stayloggedinLabel)").text(function() {
                return _i18n($(this).attr("data-i18n")).toString();
            });
            $('#stayloggedinLabel > span .ui-btn-text').text(function () {
                return _i18n($('#stayloggedinLabel').attr("data-i18n")).toString();
            })

        } else {
            $("body [data-i18n]").text(function() {
            return _i18n($(this).attr("data-i18n")).toString();
        });
        }
        // i18n placeholder texts
        $("body [i18n-placeholder]").attr('placeholder', function() {
            return _i18n($(this).attr('i18n-placeholder')).toString();
        });
        // buttons etc.
        $("body [i18n-value]").attr('value', function() {
            return _i18n($(this).attr('i18n-value')).toString();
        }).each(function (i, el) {
            // check markup for IE9
            if ($(el).hasClass('ui-btn-hidden')) {
                $(el).button('refresh');
            };
        });

    },
    initLocalConfig: function() {

        // restore initial config from localstore
        var tempConfig = null;

        if (storage.getMode() !== 0) {
            try {
                tempConfig = storage.getItem("config", true);
            } catch(e){
                _.debug("[Storage] Error during restore, ", e);
            }
        }
        if (tempConfig !== null) {
            localUserConfig = tempConfig;

            // don't restore this part of config, only do this in offline mode
            if (online) {
                localUserConfig.folderTree = {
                    contactFolders: [],
                    contactsCount: [],
                    mailFolders: [],
                    calendarFolders: []
                };
                localUserConfig.subscribedFolders = {
                    contacts: [],
                    mail: [],
                    calendar: []
                };
            }
        } else {
            // no config to load, just get browserlang
            localUserConfig.lang = util.getBrowserLang();
        }
    }
};

// get the local config from storage before
mox.init.initLocalConfig();

// force refresh on cache update
if (Modernizr.applicationcache) {
    // listen to "updateready"
    window.applicationCache.addEventListener('updateready', function(e) {
        if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
            // Browser downloaded a new app cache.
            // Swap it in and reload the page to get the new hotness.
            util.appCache.swapCache();

            var message = "";
            if ( localUserConfig.autoLogin && session) {
                message = _i18n("A new version of this site is available. Do you want to reload the page now?").toString();
            } else {
                message = _i18n("A new version of this site is available. Do you want to reload the page now? You will have to login again.").toString();
            }

            ui.showAlertBox(message,
                  { buttons: [{
                       text: _i18n("Yes").toString(),
                       action: function() {
                         window.location.reload();
                       }
                    },
                    {
                      text: _i18n("No").toString(),
                      action: $.noop,
                      delbutton: true
                    }
            ]});
        } else {
          // Manifest didn't change. Nothing new on server.
        }
    }, false);
}

// document ready is called long after mobileinit event fires.
// In multipage apps we won't use this as it is only called once.
$(document).ready(function() {

    // ensure we've got JSON support
    if (!window.JSON) {
        $.ajax({
            url: 'lib/json2.js',
            dataType: "script",
            async: false
          });
    }

    // set the user language
    setLanguage(localUserConfig.lang, function() {
        mox.init.setLanguageTags();
        $(events).trigger("language-ready");
    });

    // if dumb browser do manual placeholder
    if (!Modernizr.input.placeholder) {
        $("body")
            .on("focus blur", "input[placeholder]", function(e) {
                var input = $(this);
                switch (e.type) {
                    case 'focusin':
                        if (input.val() == input.attr('placeholder')) {
                            input
                                .val('')
                                .removeClass('placeholder');
                        }
                        break;
                    case 'focusout':
                        if (input.val() === '' || input.val() == input.attr('placeholder')) {
                            input
                                .addClass('placeholder')
                                .val(input.attr('placeholder'));
                        }
                        break;
                    default:
                        break;
                }
            });

        $(document).bind("pageinit", function(e) {
            $("input[placeholder]").blur();
        });
    }

});

// we init the page
$(document).bind("mobileinit", function() {

    // calculate the initial mail count to fill the screen
    // on each device with mails
    mox.mail.initCount = Math.max(parseInt(window.innerHeight/75 + 1), 10);


    if (isHybridApp) {
        $(window).bind("orientationchange", function(e) {
            // workaround for fixed element repaint
            if (e.orientation === 'landscape') {
                $('[data-position="fixed"]', $.mobile.activePage)
                    .css("position","relative")
                    .hide(0)
                    .delay(250)
                    .fadeIn(150, function() {
                        $(this).removeAttr("style");
                    });
            }
        });
    }
    // fix for Bug 23018 - [L3] Draft Dialog box buttons gets cut off after canceling a mail
    $(window).on('orientationchange', function(e) {
        // fix for bug 22172
        // force redraw of footer bar to apply new class

        if ($("#bottomselectbox").length !== 0) {
            ui.redrawOnRotate();
        }

        if ($.mobile.activePage.attr('id') === "contactedit") {
            var focus = $(':focus', $('#contactedit'));
            if (focus) {
                // have to delay this due to a page-min-height problem
                // with jquerymobile if this is done without delay
                setTimeout(function () {
                    $('#contactedit input').blur();
                }, 500);
            }
        }

        var isOSSix = !!navigator.userAgent.match(/iPhone OS 6/);
        if (isOSSix && ($.mobile.activePage.attr('id') === 'newmail')) {
            // fix for scale bug on iOS 6 for inputs which have a placeholder set
            var ph = $('#mail-subject-field').attr('placeholder');
            $('#mail-subject-field').attr('placeholder','').attr('palaceholder', ph);
        }
    });

    // enable loading text on pageloading msg
    $.mobile.loadingMessageTextVisible = true;

    // set default transition
    $.mobile.defaultPageTransition = transitions.defaultTransition;

    // tell jquerymobile about our new transition
    $.mobile.transitionHandlers.delayTransition = delayTransitionhandler;

    // show loading message in loading spinner overlay
    $.mobile.loadingMessageTextVisible = true;

    // init draft module
    // mox.mail.drafts = new Drafts();
    $(events).bind("config-loaded", function() {
        // create new mail object for sending
        mox.mail.newMail = new Mail();
        appointmentViewer = new AppointmentViewer();
    });

    // refresh mailfolders given via array of ids in folderlist
    $(events).bind('refresh-mail', function (e, data) {
        if (online) {
             if (!mox.refreshing) {
                mox.refreshing = true;
                mox.mail.updateMailFolders(data.folders, function () {
                    mox.refreshing = false;
                });
            }
        } else {
             ui.showOfflineMessage();
        }
    });

    $('#login').live("pageinit", function(k) {
        _.debug("init loginpage");


        $("#user").after( ui.getClearButton().bind("tap", function(e) {
                e.preventDefault();
                $("#user").val('');
            })
        );
        $("#pass,").after( ui.getClearButton().bind("tap", function(e) {
                e.preventDefault();
                $("#pass").val('');
            })
        );

        if (!isHybridApp) {
            $(events).bind('language-ready', function(){
                $('#stayloggedin').checkboxradio();
            });
        }

        // custom active styles on focus
        $(".custom-ul input").focus(function() {
            $(this).closest('li').addClass("custom-input-active");
        }).blur(function() {
            $(this).closest('li').removeClass("custom-input-active");
        });

        // append blue class to fake login button
        $("#submitBtn").parent().addClass("button-color-1");

        // login-form submit
        $("#loginform").submit(function(e) {
            // don't use prevent default or return false as standard
            // in this submit method. Since iOS will refuse to
            // save the credentials in the browser if we return false or
            // preventdefault, we will let the native form POST happen.
            // The loginform sends a POST to a blank html file and uses a
            // hidden iframe as target. This should work on all browsers

            $("#home").ajaxStop(function() {
                /* pageloading */
            });
            if (online) {
                mox.login.loginAction();
            } else {
                ui.showOfflineMessage();
            }
            // Firefox and IE will open the dummy.html in a new window if we don't
            // return false here
            if (!!navigator.userAgent.match(/Firefox/) || !!navigator.userAgent.match(/IEMobile/)) {
                return false;
            }
        });
        // check if cookies are enabled
        if (util.testCookieSettings() === false) {
            // disable login, show alert
            $("#login").live("pageshow", function() {
                $("#loginform").addClass("ui-disabled");
                ui.showAlertBox(_i18n("You have to enable cookies to use this application.").toString(),
                        { buttons: [{text: _i18n("Ok").toString(), action: $.noop}] });
            });
        }

        // try autologin for webapp
        if (online && !isHybridApp) {
            $('#login').addClass('ui-disabled');
            /* pageloading */
            mox.login.autoLogin(function (autologin) {
                if (autologin.available && autologin.success) {
                    $("#home").ajaxStop(function() {
                        /* pageloading */
                    });
                    $.mobile.changePage("#home", {transition: transitions.fade});
                    /* pageloading */
                    setTimeout(function () {
                        $('#login').removeClass('ui-disabled');
                    }, 250);
                } else if (autologin.available && !autologin.success) {

                    /* pageloading */
                    $('#login').removeClass('ui-disabled');
                } else {

                    /* pageloading */

                    $('#login').removeClass('ui-disabled');
                }
            }, true);
        }

        // famous offline mode for webapp
        if ( (online === false) &&
             (localUserConfig.autoLogin === true) &&
             (isHybridApp === false)) {

            $("#home").live("pageshow", function() {
                ui.mail.updateCountBubbles();
            });

            $.mobile.changePage("#home", {transition: transitions.fade});
            datastore.restoreData();

        }

    });

    $('#login').live('pageshow', function() {
        _.debug('loginpage pageshow');
        // if a user uses browser back and arrives here, bring him back to the main menu to
        // prevent him pressing login a second time
        if (window.session !== undefined && !mox.login.performRelogin) {
           setTimeout(function() {
               $.mobile.changePage($('#home'), {transition: transitions.fade});
           }, 50);
        }
    });

    $("#home").live('pageshow', function () {
        setTimeout(function () {
            window.scrollTo(1,0);
            window.scrollTo(0,0);
        }, 300);
    });
    $("#home").live("pagebeforecreate", function() {
        _.debug("pagebefore menu");

        $("#my-contacts").bind("tap", function(e) {
            e.preventDefault();
            if (localUserConfig.subscribedFolders.contacts.length !== 0) {
                $.mobile.changePage("#contacts", {transition: transitions.slide});
            } else {
                ui.showAlertBox(_i18n("Please select the folders you want to access.").toString(),
                        {buttons: [{text: _i18n("Ok").toString(), action: $.noop}]});
            }
        });

        // reload
        $(".footer-icon.menu.reload").bind("click", function(e) {
            e.preventDefault();
            if (mox.refreshing === false) {
                $(events).trigger("refresh");
            }
        });
        // mail compose
        $(".footer-icon.compose", $('#home')).bind("click", function(e) {
            e.preventDefault();
            // TODO offline drafts
            $(events).trigger("compose_mail");
            mox.mail.newMail.setLastPage('#home');
            $.mobile.changePage("#newmail", {transition:  transitions.slideup});
        });

        // ***** register events ******************

        // select start on maillist
        $(events).bind("listview_select_start", function(e, f) {
            // disable buttons and modify toolbar
            ui.page.actionEditButton(f);
        });

        // selection end on maillist (no mails selected)
        $(events).bind("listview_select_end", function(e, f) {
            // disable buttons and modify toolbar
            ui.page.actionEditButton(f);
        });

        $(events).bind('refresh-calendar', function () {
            if (online && !mox.refreshing) {
                // update calendar if possible
                if (localUserConfig.activeModules.calendar === true) {
                    mox.refreshing = true;
                    mox.calendar.getUpdates();
                }
            }
        });

        // global refresh
        $(events).bind("refresh", function(e) {

            if (online) {
                if (!mox.refreshing) {
                    mox.refreshing = true;
                    _.debug("refresh triggered", e);
                    /* pageloading */
                    var f = localUserConfig.folderTree.standardMailFolders;
                    var k = localUserConfig.subscribedFolders.mail;
                    var list = [];
                    $.each(f, function(i, e) {
                        list.push(e.id);
                    });
                    list = list.concat(k);

                    mox.mail.updateMailFolders(list, function() {
                        mox.refreshing = false;
                    });

                    // update calendar if possible
                    if (localUserConfig.activeModules.calendar === true) {
                            mox.refreshing = true;
                        mox.calendar.getUpdates();
                    }
                }
                mox.contacts.checkUpdates();
            } else {
                ui.showOfflineMessage();
            }
        });
    });

    $("#calendar").live( "pageinit" , function() {
        $("#calendar-reload").bind( "tap" , function(e) {
            e.preventDefault();
            if (online) {
                mox.calendar.getUpdates();
            } else {
                ui.showOfflineMessage();
            }
        });
        $('#addappointmentbutton').bind("tap", function(e) {
            e.preventDefault();
            if (online) {
                appointmenteditor.newAppointment(function() {
                    $.mobile.changePage("#appointmentedit", { transition : transitions.slideup });
                });
            } else {
                ui.showOfflineMessage();
            }
        });
    }).live('pagebeforeshow', function (e) {
        // ensure to update if needed
        if ($('ul', this).hasClass('ui-listview')) {
            $('ul', this).listview('refresh');
            globalAppointmentListView.setNewList = false;
        }
    });

    $(document).bind('pagebeforechange', function (e, data) {
        if (_.isString(data.toPage) && data.toPage.match(/#appointmentdetail/)) {
            // check if appointment was deleted (browser back issue)
            if (appointmentViewer.validateCurrent() === false) {
                e.preventDefault();
            }
        }
    });

    $("#appointmentdetail").live("pagebeforeshow", function() {
        _.debug("mailfolders pagecreate");
        appointmentViewer.refresh();
    });

    $("#appointmentedit").live("pageinit", function() {

        var saveFunction = function(backButton, e) {
            if (!online) {
                if (backButton) {
                    ui.page.goBack();
                } else {
                    ui.showOfflineMessage();
                }
                return;
            }
            var diff = appointmenteditor.getFormData();
            if (diff.changed) {
                var cap = appointmenteditor.getCurrentAppointment();
                e.preventDefault();

                // define create or update action
                var action = function() {
                    // define callback
                    var cb = function(data, ap) {
                        _.debug(1, 'saveAction Callback', data, ap);
                        mox.calendar.getUpdates(function() {
                            // if series change to appoitnment list
                            if (diff.editSeries || !ap) {
                                $.mobile.changePage("#calendar", { transition : transitions.slidedown });
                            } else {
                                appointmentViewer.showAppointment(data.data.id, -1);
                                $.mobile.changePage("#appointmentdetail", {transition: transitions.slide, reverse: true});
                            }
                            /* pageloading */
                        });
                    };

                    if (!cap.id) {
                        if (!diff.diff.folder_id) {
                            ui.showAlertBox(_i18n("Please select a folder.").toString(),
                                { buttons: [{text: "OK", action: $.noop}] }
                            );
                        } else {
                            /* pageloading */
                            mox.calendar.createAppointment(diff.diff, cb);
                        }
                    } else {
                        /* pageloading */
                        mox.calendar.updateAppointment(cap, diff.diff, cb);
                    }
                };

                // show selection dialog
                if (backButton) {
                    // define buttons
                    var buttons = [{
                        text: _i18n("Discard Changes").toString(),
                        delbutton: true,
                        action: ui.page.goBack
                    },{
                        text: _i18n("Save Appointment").toString(),
                        secondary: true,
                        action: action
                    },  {
                        text: _i18n("Cancel").toString(),
                        primary: true,
                        action: $.noop
                    }];

                    // show overlay
                    ui.bottomSelectBox({
                        buttons: buttons,
                        method: "click" // tap can effect ghostcklicks
                    });
                } else {
                    action();
                }
            } else {
                ui.page.goBack();
            }
        };

        $("#appedit_back").bind("tap", function(e) {
            e.preventDefault();
            globalContactListViews.all.setSelectMode(false);
            globalContactListViews.all.setSelectMetaData({});
            saveFunction(true, e);
        });

        $("#saveappointmentbutton").bind("tap", function(e) {
            saveFunction(false, e);
        });
    });

    // do init on mailfolders page
    $("#mailfolders").live("pageinit", function() {
        // if no private mail folders are selected show a warining about that
        $("#mailfolderlist_private").bind("tap" , function(e) {
            e.preventDefault();
            if (localUserConfig.subscribedFolders.mail.length === 0) {
                ui.showAlertBox(_i18n("Please select the folders you want to access.").toString(),
                {
                    buttons: [{text: _i18n("Ok").toString(), primary: true, action: function() {
                        // jump to settings page
                        $.mobile.changePage("#settings-mail", {transition: transitions.slideup});
                        }
                    },
                    {text: _i18n("Cancel").toString(), action: $.noop}]
                });
            } else {
                // show mailfolders which are selected
                $.mobile.changePage("#privatemailfolders", {transition: transitions.slide});
            }
        });
    });

    // add autoloader on scrollstop to realize infinite scroll
    var lastScrollTime = 0,
        LASTSCROLLTHRESHOLD = 300, // latency between two scrollstop events in milliseconds
        SCROLLSTOPTHRESHOLD = 150; // distance added to triggerelement 2x div-height
    $(window).bind("scrollstop", function(e) {
        // only in mailfolders
        if ($.mobile.activePage.attr('id').substr(0,3) === 'mf_') {
            // allow event every 300 millisec.
            if (e.timeStamp > (lastScrollTime + LASTSCROLLTHRESHOLD)) {
                lastScrollTime = e.timeStamp;
                // get windows and element values
                var $el = $('.autoload', $.mobile.activePage);
                // only do this if there is the "autoload" elem
                if ($el && $el.length > 0) {
                    var vTop = $(window).scrollTop(),
                        vBot = vTop + $(window).height(),
                        elTop = $el.offset().top - SCROLLSTOPTHRESHOLD,
                        elBot = elTop + $el.height();
                    if ((elBot >= vTop) && (elTop <= vBot) && (elBot <= vBot) &&  (elTop >= vTop)) {
                        $el.hide().trigger("touchstart");
                    }
                }
            }
        }
    });

    $("#privatemailfolders").live("pageinit", function() {
        _.debug("privatemailfolders pagecreate");
        $("#privatemailfolderslist").listview();
    });

    $("#mailmove").live("pageinit", function() {
        _.debug("movefolders pagecreate");

        $("#movefolderlist").listview();
        // hide the list arrows
        $("#movefolderlist  .ui-icon-arrow-r").hide();

        $("#mailmovecancelbutton").bind("tap", function(e) {
            e.preventDefault();
            ui.page.goBack();
        });

    });

    $("#maildetail").live("pageshow", function(e) {
        if (window.session !== undefined) {
            $(events).trigger("maildetail_show");
        }
    });

    $("#maildetail").live("pageinit", function() {
        _.debug("pagecreate maildetail");
        if (window.session === undefined) {
            $.mobile.changePage("#login");
        }

        $("#mailup-btn").bind( "tap", function(e) {
            e.preventDefault();
            mailviewer.showNextMail();
        });

        $("#maildown-btn").bind( "tap", function(e) {
            e.preventDefault();
            mailviewer.showPrevMail();
        });

        $("#mail-detail-mark").bind( "tap", function(e) {
           e.preventDefault();
           if (online) {
               mailviewer.markMail();
           } else {
               ui.showOfflineMessage();
           }
        });

        // footer icons
        $(".footer-icon.reload", $('#maildetail')).bind('click', function (e) {
            e.preventDefault();
            $(events).trigger('refresh-mail', {folders: [mailviewer.getActualMailShowing().folder]});
        });

        $(".footer-icon.compose", $('#maildetail')).bind("click", function(e) {
            e.preventDefault();
            // TODO offline drafts
            $(events).trigger("compose_mail");
            mox.mail.newMail.setLastPage('#maildetail');
            $.mobile.changePage("#newmail", {transition:  transitions.slideup});
        });

        // move button
        $(".footer-icon.move").bind("click", function(e) {
            if (online) {
                e.preventDefault();

                // ask mail viewer for data
                var maildata = mailviewer.getActualMailShowing();
                mox.mail.showMoveStatusMessage(
                        _i18n("Please select a target folder.").toString(), { });

                $.mobile.changePage("#mailmove", {transition: transitions.slideup});
                var srcfolder = maildata.folder;

                var mail = [{
                    id: maildata.id,
                    destfolder: "",
                    srcfolder: srcfolder
                }];

                var srcfoldername = mox.mail.getFolderFromMap(srcfolder);
                    srcfoldername = srcfoldername.folder;

                // will be bound to the event
                var folder_select_function = function(e, obj) {

                    var destfolder = mox.mail.folderIDMap[obj.folder].folderid;
                    if (srcfolder === destfolder) {
                        // error
                        /*
                         * ui.showAlertBox(_i18n("Can not move mails, source and
                         * destination are the same").toString(), { buttons:[{
                         * text: _i18n("Ok").toString(), action: $.noop }] });
                         */
                        ui.page.goBack();
                    } else {
                        // inject chosen folderid
                        mail[0].destfolder = destfolder;

                        // move mails and update folders
                        mox.mail.moveMail(mail, function(e) {
                            mox.mail.updateMailFolders([destfolder, srcfolder], function() {
                                mox.mail.showMoveStatusMessage(_i18n("Your E-Mails have been moved.").toString(), {
                                    time: 1500, // how long will the message be displayed
                                    callback: function() {
                                        var index = mox.mail.getFolderFromMap(srcfolder);
                                        $.mobile.changePage("#mf_" + index.index, {transition: transitions.slide, reverse: true});
                                    }
                                });
                            });
                        },  function(e) {

                            mox.error.handleError(e, function() {
                                ui.page.goBack();
                            });
                        });
                    }
                    $(events).unbind("folder_selected");
                };
                $(events).bind("folder_selected", folder_select_function);
            } else {
                ui.showOfflineMessage();
            }
        });

        // delete button
        $(".footer-icon.delete").bind("click", function(e) {
            if (online) {
                e.preventDefault();
                var maildata = mailviewer.getActualMailShowing();
                var trashid = localUserConfig.folderTree.standardMailFolders['4_trash'].id;
                var folder = maildata.folder;

                var deleteMails = [{
                    id: maildata.id,
                    folder: folder
                }];

                var deleteAction = function() {
                    /* pageloading */
                    mox.mail.deleteMails(deleteMails, function() {

                        mox.mail.updateMailFolders([folder, trashid], function() {
                            $.mobile.changePage($(window.location.hash), {transition: transitions.slide, reverse: true});
                        });

                        /* pageloading */

                    });
                };

                // test if we are in trash. if so, display warning
                if ( folder === localUserConfig.folderTree.standardMailFolders["4_trash"].id) {
                    ui.showAlertBox(_i18n("Permanently delete E-Mails?").toString(),
                            {
                                buttons: [{
                                    text: _i18n("Cancel").toString(),
                                    action: $.noop

                                }, {
                                    text: _i18n("Delete").toString(),
                                    action: deleteAction,
                                    delbutton: true
                                }]
                            });
                } else {
                    // do it!
                    deleteAction();
                }
            } else {
                ui.showOfflineMessage();
            }
        });

        $(".footer-icon.answer").bind("click", function(e) {
            if (online) {
                e.preventDefault();
                var maildata = mailviewer.getActualMailShowing();
                var buttons = [{
                        text: _i18n("Answer").toString(),
                        primary: true,
                        action: function() {
                            mox.mail.newMail.replyMail(maildata, true, function() {
                                $.mobile.changePage("#newmail", {transition: transitions.slideup});
                                mox.mail.newMail.setLastPage("#maildetail");
                                setTimeout( function() {
                                    $("#mail-text-area").focus();
                                }, 1000);
                            });
                        }
                    }, {
                        text: _i18n("Forward").toString(),
                        primary: true,
                        action: function() {
                            mox.mail.newMail.forwardMail(maildata, function() {
                                $.mobile.changePage("#newmail", {transition: transitions.slideup});
                                mox.mail.newMail.setLastPage("#maildetail");
                            });
                        }

                    }, {
                        text: _i18n("Cancel").toString(),
                        secondary: true,
                        action: $.noop
                    }];

                    ui.bottomSelectBox({
                        buttons: buttons,
                        method: "click" // tap can effect ghostcklicks
                    });
            } else {
                ui.showOfflineMessage();
            }
        });
    });

    $("#contacts")
        .live("pageinit", function(e) {
            $("#cancelcontactsbutton").bind("tap", function(e) {
               e.preventDefault();
               //ui.page.goBack();
               $.mobile.changePage(globalContactListViews.all.getLastPage(), {transition: transitions.slidedown, changeHash: false});
               globalContactListViews.all.setLastPage("");
            });
            $("#addcontactsbutton").bind("tap", function(e) {
                e.preventDefault();
                if (online) {
                    contacteditor.editContact(null, function() {
                        $.mobile.changePage("#contactedit", { transition : transitions.slideup });
                    });
                } else {
                    ui.showOfflineMessage();
                }
            });
        })
        .live("pagehide", function(e) {
            $("#contacts .ui-input-text").val("").trigger("keyup");
        })
        .live('pagebeforeshow', function (e) {
            if ($('ul', this).hasClass('ui-listview')) {
                $('ul', this).listview('refresh');
            }
        });


    $("#contactdetail").live("pageinit", function(e) {

        $("#editcontactsbutton").bind("click", function(e) {
            e.preventDefault();
            if (online) {
                contacteditor.editContact(contactviewer.getCurrentContactId(), function() {
                    $.mobile.changePage("#contactedit", { transition : transitions.slideup });
                });
            } else {
                ui.showOfflineMessage();
            }
        });

        contactviewer.setWasInited(true);
        $("#contactdetail .custom-backbutton").bind("tap", function(e) {
            e.preventDefault();
            if (globalContactListViews.all.getSelectMode() === true) {
                $.mobile.changePage("#contacts", {transition: transitions.slide, reverse: true, changeHash: false});
            } else {
                ui.page.goBack();
            }
        });
    });

    $("#contactedit").live("pageinit", function(e) {
        _.debug('contactedit pageinit');
        var saveFunction = function(backButton, e) {
            e.preventDefault();
            if (!online) {
                if (backButton) {
                    ui.page.goBack();
                } else {
                    ui.showOfflineMessage();
                }
                return;
            }
            var diff = contacteditor.getFormData();
            if (!_.isEmpty(diff)) {

                // define callback
                var cb = function() {
                    mox.contacts.checkUpdates(function() {
                        contactviewer.refreshContact(function() {
                            ui.page.goBack();
                            /* pageloading */
                        });
                    });
                };

                // define create or update action
                var action = function() {
                    var cD = contacteditor.getCurrentContact();
                    if (_.isEmpty(cD)) {
                        if (!diff.folder_id) {
                            ui.showAlertBox(_i18n("Please select a folder.").toString(),
                                { buttons: [{text: "OK", action: $.noop}] }
                            );
                        } else {
                            /* pageloading */
                            mox.contacts.createContact(diff, cb);
                        }
                    } else {
                        /* pageloading */
                        mox.contacts.updateContact(cD, diff, cb);
                    }
                };

                // show selection dialog
                if (backButton) {
                    // define buttons
                    var buttons = [{
                        text: _i18n("Discard Changes").toString(),
                        delbutton: true,
                        action: function() {
                            ui.page.goBack();
                        }
                    },{
                        text: _i18n("Save Contact").toString(),
                        secondary: true,
                        action: function() {
                            action();
                        }
                    },  {
                        text: _i18n("Cancel").toString(),
                        primary: true,
                        action: $.noop
                    }];

                    // show overlay
                    ui.bottomSelectBox({
                        buttons: buttons,
                        method: "click" // tap can effect ghostcklicks
                    });
                } else {
                    action();
                }
            } else {
                ui.page.goBack();
            }
        };

        $("#contactedit .custom-backbutton").bind("tap", function(e) {
            saveFunction(true, e);
        });

        $("#savecontactbutton").bind("tap", function(e) {
            saveFunction(false, e);
        });
    });

    // new mail page init
    $("#newmail").live("pageinit", function(e) {
        // make input textarea bigger
        var height = ($.mobile.getScreenHeight() - 200) > 100 ? $.mobile.getScreenHeight() - 200 : 100;
        $("#mail-text-area").css("height", height + "px");

        $("#cancelmailbutton").bind( "tap" , function(e) {
            e.preventDefault();

            globalContactListViews.all.setSelectMode(false);
            globalContactListViews.all.setSelectMetaData({ });

            if (!mox.mail.newMail.inputPerformed()) {
                ui.page.goBack();
                mox.mail.newMail.reset();
            } else {
                // turn off "offline" drafts for now
                if (online) {
                    // we need a timeout to wait for androids keyboard to fade
                    // out
                    setTimeout(function() {
                        ui.bottomSelectBox( {buttons: [
                            {
                                text: _i18n("Delete draft").toString(),
                                action: function () {
                                    // clear input and go back
                                    $.mobile.changePage(mox.mail.newMail.getLastPage(),
                                            {transition: transitions.slideup, reverse: true});

                                    mox.mail.newMail.setLastPage("");

                                    if (mox.mail.newMail.calledFromContactDetail.state === true) {
                                        // restore state of contactdetail page
                                        contactviewer.drawContact(mox.mail.newMail.calledFromContactDetail.id, function() {
                                            mox.mail.newMail.calledFromContactDetail = {state: false, id: null};
                                        });
                                    }
                                    if (mox.mail.newMail.isDraftEdit()) {
                                        // delete draft on server
                                        mox.mail.deleteMails([mox.mail.newMail.getDraftID()], function () {
                                            mox.mail.updateMailFolders([localUserConfig.folderTree.standardMailFolders["2_drafts"].id], $.noop);
                                        });
                                    }
                                    mox.mail.newMail.reset();
                                },
                                delbutton: true
                            },
                            {
                                text: _i18n("Save draft").toString(),
                                action: function() {
                                    // save draft on backend
                                    /* pageloading */

                                    mox.mail.newMail.saveDraft(function() {
                                        if (online) {
                                            var draftid = localUserConfig.folderTree.standardMailFolders["2_drafts"].id;
                                            mox.mail.updateMailFolders([draftid], $.noop);
                                        }
                                        /* pageloading */

                                        $.mobile.changePage(mox.mail.newMail.getLastPage(),
                                                {transition: transitions.slideup, reverse: true });

                                        mox.mail.newMail.setLastPage("");

                                        if (mox.mail.newMail.calledFromContactDetail.state === true) {
                                            // restore state of contactdetail page
                                            contactviewer.drawContact(mox.mail.newMail.calledFromContactDetail.id, function() {
                                                mox.mail.newMail.calledFromContactDetail = {state: false, id: null};
                                            });
                                        }
                                    });

                                    },
                                secondary: true
                            },
                            {
                                text: _i18n("Cancel").toString(),
                                action: function() {
                                    ui.removeBottomSelectBox();
                                },
                                primary: true
                            }
                         ], method: "touchstart mousedown"});
                        ui.redrawOnRotate(); // need to reposition the box for android
                    }, 300);


                } else {
                    // need a offline draft mode
                    // mox.mail.newMail.saveDraft(); // turned off at the moment
                    $.mobile.changePage(mox.mail.newMail.getLastPage(),
                            {transition: transitions.slideup, reverse: true });
                    mox.mail.newMail.setLastPage("");
                }
            }
        });

        $("#sendmailbutton").bind( "tap", function(e) {

            e.preventDefault();
            if (online) {
                /* pageloading */
                var subject = $("#mail-subject-field").val();
                var text = $('#mail-text-area').val();

                mox.mail.newMail.setMailText(text);
                mox.mail.newMail.setSubject(subject);
                mox.mail.newMail.sendMail();
                globalContactListViews.all.setSelectMode(false);
                globalContactListViews.all.setSelectMetaData({ });
            } else {
                ui.showOfflineMessage();
            }
        });

        // hide at first
        $("#newmail-bcc-table").hide();

        /** ************* TO FIELD *************************** */

        $('#emailToField').focus( function(e) {
            _.debug('to input focus',e, e.target.id);
            // TO inputfield, process focus event
            $('#addcontactbuttonTO').css('visibility', 'visible');
            $('#addcontactbuttonCC, #addcontactbuttonBCC').css('visibility', 'hidden');
        });

        // add contact button for to field
        $('#addcontactbuttonTO').bind('click', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            globalContactListViews.all.setSelectMode(true);
            globalContactListViews.all.setSelectMetaData({ contactSelect: 'to' });
            $.mobile.changePage('#contacts', {transition: transitions.slideup, changeHash: false});
            globalContactListViews.all.setLastPage('#newmail');
        });

        // to row
        $('#newmail-to-row').bind('tap', function(e) {
            e.preventDefault();
            $('#emailToField').css('visibility','visible').focus();

            if (mox.mail.newMail.getBCCs().length === 0 &&
                    mox.mail.newMail.getCCs().length === 0) {
                $('#newmail-bcc-table').hide();
                $('#label-cc-bcc').text(_i18n('Cc/Bcc:').toString());
            }
        });


        /** ************* CC FIELD *************************** */

        $('#emailCcField').focus( function(e) {
            _.debug('cc input focus',e, e.target.id);
            // CC inputfield, process focus event
            $('#addcontactbuttonCC').css('visibility', 'visible');
            $('#addcontactbuttonTO, #addcontactbuttonBCC').css('visibility', 'hidden');
        });

        // add contact button for cc field
        $('#addcontactbuttonCC').bind('click', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            globalContactListViews.all.setSelectMode(true);
            globalContactListViews.all.setSelectMetaData({ contactSelect: 'cc' });
            $.mobile.changePage('#contacts', {transition: transitions.slideup, changeHash: false});
            globalContactListViews.all.setLastPage('#newmail');

        });

        // cc row
        $('#newmail-cc-row').bind( 'tap' , function(e) {
            e.preventDefault();
            // show bcc row
            $('#newmail-bcc-table').show();

            // change label, only at the first time we enter the field
            // otherwise every new row will get an unwanted 'cc' label, too.
            if (mox.mail.newMail.getCCs().length === 0) {
                $('#label-cc-bcc').text(_i18n('Cc:').toString());
            }

            $('#addcontactbuttonCC').css('visibility', 'visible');
            $(this).children().css('visibility', 'visible');
            $('#emailCcField').focus();
        });

        /** ************* BCC FIELD *************************** */

        $('#emailBccField').focus( function (e) {
            _.debug('bcc input focus',e, e.target.id);
            // BCC inputfield, process focus event
            $('#addcontactbuttonBCC').css('visibility', 'visible');
            $('#addcontactbuttonTO, #addcontactbuttonCC').css('visibility', 'hidden');
        });

        // add contact button for bcc field
        $('#addcontactbuttonBCC').bind('click', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            globalContactListViews.all.setSelectMode(true);
            globalContactListViews.all.setSelectMetaData({ contactSelect: 'bcc' });
            $.mobile.changePage('#contacts', {transition: transitions.slideup, changeHash: false});
            globalContactListViews.all.setLastPage('#newmail');
        });

        // bcc row
        $('#newmail-bcc-row').bind('tap', function(e) {
            e.preventDefault();
            $('#emailBccField').css('visibility', 'visible').focus();
        });

        $('#mail-subject-field, #mail-text-area').focus(function(e) {
            // we need to delay this because getCCs will return 0
            // if we don't wait for the blur on the input field which is handled
            // by the autocomplete
            setTimeout( function() {
                if (mox.mail.newMail.getBCCs().length === 0 &&
                        mox.mail.newMail.getCCs().length === 0) {
                    $('#newmail-bcc-table').slideUp(function () {
                        $('#label-cc-bcc').text(_i18n('Cc/Bcc:').toString());
                    });
                }
            }, 300);
        });

        $('#emailToField ,#emailCcField ,#emailBccField ').blur( function(e) {
            _.debug('input blur',e, e.target.id, $(this));
            $('.lastfocus').removeClass('lastfocus');
            $(this).css('visibility', 'hidden').addClass('lastfocus');
        });

        // ensure one click on subject is enough to enter the field
        $('#mail-subject-field').on('tap', function(e) {
            // prevent native focus event after touchstart
            e.preventDefault();
            $('.lastfocus').blur();
            $(this).focus();
        })
    });

    /**
     * init of newmail page init autocomplete for input fields
     */
    $("#newmail").live("pageshow", function() {
        _.debug("pageshow newmail");

        // force resize of textfield after reply/forward
        $("#mail-text-area").trigger("keyup");

        // remember page we came from
        if (mox.mail.newMail.getLastPage() === "") {
            var last = $.mobile.urlHistory.getPrev();
            mox.mail.newMail.setLastPage("#" + last.url);
        }

        if (!autocomplete) {
            $("#emailToField").autocomplete(mox.contacts.autocompleteList, {field: "to"});
            $("#emailCcField").autocomplete(mox.contacts.autocompleteList, {field: "cc"});
            $("#emailBccField").autocomplete(mox.contacts.autocompleteList, {field: "bcc"});
            autocomplete = true;
        }

        // focused elements on this site
        var $foc = $('input:focus', this);
        if ($foc.length === 0) {
            _.debug('nothing focused');
            $("#emailToField").trigger("tap");
        } else {
            _.debug('pageshow focused element', $foc);
        }

    });

    $("#newmail").live("pagebeforehide", function() {
        // hide keyboard
        $('input:focus').blur();
        document.activeElement.blur();
    });

    $("#settings").live("pageinit", function (e) {
        _.debug("pageinit settings");
        // init text on settings page
        mox.settings.appointments.numberOfDaysChanged();
        // append blue class to logout button
        $("#logoutBtn").parent().addClass("button-color-1").bind("tap", function (e) {

            e.preventDefault();
            if ( online ) {
                mox.login.logout();
            } else {
                ui.showOfflineMessage();
            }
        });
    });
    // legal page shown on login screen
    $("#legal").live("pageinit", function (e) {
        _.debug("pageinit legal");

        // append version string
        $(".versionstring1").append($("<span>").text(" " + mox.product.pversion));

        // append blue class to close button
        $("#closeBtn").parent().addClass("button-color-1").bind("tap", function (e) {
            ui.page.goBack();
            return false;
        });
    });

    // in-app legal page
    $("#legal2").live("pageinit", function (e) {
        _.debug("pageinit legal2");
        // append version string
        $(".versionstring2").append($("<span>").text(" " + mox.product.pversion));
    });

    $("#settings-calender").live("pagebeforecreate", function (e) {
        _.debug("pagebeforecreate settings-calendar");
        // init list item with defaults
        var list = new ListSelect({
            id: "settings-calendar-list",
            container: $("#settings-calendar-list"),
            // defaultSelected: localUserConfig.appointmentDays,
            onChange: function(list, data) {

                // set new option at config
                localUserConfig.appointmentDays = data.days;

                mox.config.saveLocalUserConfig();
                // trigger global event
                $(events).trigger("settings-calendar-appointmentDaysChanged", data);

            }
        });
        // add available defaults
        $.each(mox.settings.appointments.defaults, function(key, val) {
            list.add({
                key: key,
                value: val.text.toString(),
                data: {
                    days: val.days,
                    value: val.text,
                    selected: (localUserConfig.appointmentDays === val.days)
                }
            });
        });
    });

    $("#settings-mail").live("pagebeforecreate", function (e) {
        // init list item with defaults
        var list = new ListSelect({
            id: "settings-mail-list",
            container: $("#settings-mail-list"),
            multiple: true,
            onChange: function(list, selected, allSelected) {
                var folder = [];
                // build config array with IDs
                for (var i=0; i < allSelected.length; i++) {
                    _.debug(list);
                    var node = list.get(allSelected[i]);
                    if (node && node.data("data")) {
                        folder.push(node.data("data").folder);
                    }
                }
                // trigger global event
                $(events).trigger("settings-mail-folderChanged", { folders: folder });
            }
        });

        var folder = [];
        if (localUserConfig.folderTree && localUserConfig.folderTree.mailFolders) {
            folder = localUserConfig.folderTree.mailFolders;
        }

        // add available defaults
        $.each(folder, function(index, folder) {
            list.add({
                key: index,
                value: folder.title,
                data: {
                    folder: folder.folder,
                    title: folder.title
                }
            });
        });

        if (folder.length === 0) {
            $("#mail_folder_select_label").text(_i18n("Folder is empty").toString());
        }
        mox.settings.maillist = list;
        list.selectById(localUserConfig.subscribedFolders.mail, true);
    });

    $("#settings-contacts").live("pagebeforecreate", function (e) {
        // init list item with defaults
        var list = new ListSelect({
            id: "settings-contacts-list",
            container: $("#settings-contacts-list"),
            multiple: true,
            onChange: function(list, selected, allSelected) {
                var folder = [];
                // build config array with IDs
                for (var i=0; i < allSelected.length; i++) {
                    var node = list.get(allSelected[i]);
                    if (node && node.data("data")) {
                        folder.push(node.data("data").folder);
                    }
                }
                // trigger global event
                $(events).trigger("settings-contacts-folderChanged", { folders: folder, selected: selected});
            }
        });

        var folder = [];
        if (localUserConfig.folderTree && localUserConfig.folderTree.contactFolders) {
            folder = localUserConfig.folderTree.contactFolders;
        }

        // add available defaults
        $.each(folder, function(index, folder) {
            var count = localUserConfig.folderTree.contactsCount[folder[0]];
            var $html = $("<div>").append(
                        $("<div>").text(folder[2])
                                  .addClass("contacts-settings-title"))
                        .append($("<div>")
                                // #. text showing how many contacts are
                                // included in one contact folder
                                .text(format(_i18n("%n contacts"), count).toString())
                                .addClass("contacts-settings-count"));

            list.add({
                key: index,
                value: folder[2],
                data: {
                    folder: folder[0],
                    title: folder[2]
                },
                html: $html,
                customIconClass: "contacts"
            });
        });

        if (folder.length === 0) {
            $("#contact_folder_select_label").text(_i18n("Folder is empty").toString());
        }

        mox.settings.contactlist = list;
        list.selectById(localUserConfig.subscribedFolders.contacts, true);
    });
    // triggerd after config is ready
    $(events).bind("config-loaded", function (e) {
        // set display_name and headline
        if (userData) {
            $("#settings-display_name").text(userData.display_name || "");
            $("#settings-primary_mail").text(userData.email1 || "");
        }
    });

    // triggerd when days for appointment change
    $(events).bind("settings-calendar-appointmentDaysChanged", function(e, f) {
        if ( online ) {
            /* pageloading */
            mox.calendar.getAppointmentList(localUserConfig.appointmentDays, function() {
               /* pageloading */
               globalAppointmentListView.renew();
            });
        } else {
            ui.showOfflineMessage();
        }
    });

    // all contact folders loaded
    $(events).bind("folders-contacts-loaded", function() {
        // load contacts after folder tree is ready
        mox.contacts.getContactCount(localUserConfig.folderTree.contactFolders);
    });

    /**
     * new mail folder was selected in settings
     */
    $(events).bind("settings-mail-folderChanged", function(e, f) {
        if (online) {
            var newlist = f.folders;
            var oldlist = localUserConfig.subscribedFolders.mail;

            var remove = _.difference(oldlist, newlist);
            var load = _.difference(newlist, oldlist);
            var folder;

            if (load.length > 0) {

                folder = $.grep(localUserConfig.folderTree.mailFolders, function(j, index) {
                    return (j.folder == load[0]);
                });

                mox.mail.getAllIDs([{folder: folder[0].folder, name: folder[0].title, standardfolder: false}],
                        function() {
                            try {
                                $("#privatemailfolderslist").listview("refresh");
                                $("#movefolderlist").listview("refresh");
                            } catch(e) {
                            }
                        }, {update: false});
            }

            if (remove.length > 0) {
                mox.mail.removeLocalMailFolder(remove[0]);
            }
            localUserConfig.subscribedFolders.mail = newlist;
            /* pageloading */
            mox.config.saveLocalUserConfig();
            ui.mail.updateCountBubbles();
        } else {
            ui.showOfflineMessage();
        }
    });

    /**
     * update contact list on each config change in contact folders
     */
    $(events).bind("settings-contacts-folderChanged", function (e, f) {
        if (online) {
            var clickedFolder= String(f.selected.folder);
            var contacts =  f.folders;
            var contactsum = 0;

            for (var i = 0; i < contacts.length; i++) {
                contactsum += localUserConfig.folderTree.contactsCount[contacts[i]];
            }

            _.debug("settings-contacts-folderChanged", clickedFolder, contacts, contactsum);

            var refresh = function() {
                // set new option at config
                localUserConfig.subscribedFolders.contacts = f.folders;
                mox.config.saveLocalUserConfig();

                // only redraw if at least one folder is selected
                /* pageloading */
                mox.contacts.getAllContactsSorted(f.folders, function() {
                    $(events).trigger("email-list-update");
                    /* pageloading */
                });
            };
            // show warning if too much contacts are selected
            if (contactsum >= MAXCONTACTS) {
                // 450 ms delay before popup shows up
                setTimeout(function() {
                    ui.showAlertBox(_i18n("You have chosen a large number of contacts. This can significantly affect the response time.").toString(),
                        { buttons: [{
                                text: _i18n("Ok").toString(),
                                action: function() {
                                    refresh();
                                }

                            }, {
                                text: _i18n("Cancel").toString(),
                                action: function() {
                                   // unselecte last row
                                   mox.settings.contactlist.selectById([clickedFolder], false);
                                },
                                primary: true
                            }
                        ]});
                }, 450 );
            } else {
                refresh();
            }
        } else {
            ui.showOfflineMessage();
        }
    });

   $("#maps").live("pageinit", function() {
      var availheight = (window.innerHeight - 45) +"px";
      $("#map_canvas").css("height",availheight);
   }).live("pageshow", function() {
       setTimeout(function() {
           mox.maps.map.setCenter(mox.maps.center);
       }, 350);
       google.maps.event.trigger(mox.maps.map, 'resize');
   });

   $("#errors").live("pagecreate", function() {
       mox.error.newError("[INFO] Running version: " + mox.product.pversion);
   });

});

/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

/**
 * Class ListView
 * @param container
 * @returns
 */
var MailListView = function (container, data) {

    var thisFolder = data.folder,
        loadButtonData = {},
        loadButton = null,
        selectedRows = [],
        emptyMessage = _i18n("Folder is empty").toString(),
        type = "listview",
        inset = false,
        buttonEnabled = true,
        mailcount = 0,
        currentmailcount = 0,
        isDraftFolder = false,
        internalid = data.internalid,
        listitems = [],
        newlist = true,
        selectMode = false;

    var node = $("<ul>").attr({
        "data-role": type
    });

    // empty node
    container.empty().append(node);

    // TODO rethink this method, don't bind a function to each node. this will leak...
    //private bindAction
    var bindAction = function(node, action) {
        if (node && action) {
            $(node).bind("tap", function(e) {
                e.preventDefault();
                if (selectMode === false) {
                    /* pageloading */

                    if (isDraftFolder) {
                        // special handling for offline drafts and "real" drafts
                        if ( false /*typeOf(action) === "object"*/) {
                            // the case for an offline draft
                            //var draft = mox.mail.drafts.getDraft(action.draftid);
                            //mox.mail.newMail.editDraftMail(draft, { });
                            //$.mobile.changePage("#newmail", {transition: transitions.slideup});
                        } else {
                            // real draft from server
                            var thisnode = $(e.currentTarget).parent().find($(".mailselector"));
                            var id = thisnode.attr("data-mail-id");
                            // special draft folder handling
                            mox.mail.getDraftMail(id, thisFolder, function(e) {
                                mox.mail.newMail.editDraftMail(e, {id: id, folder: thisFolder});
                                $.mobile.changePage("#newmail", {transition: transitions.slideup});
                                mox.mail.newMail.setLastPage("#mf_2");
                            });
                        }
                    } else {
                        action();
                    }

                } else if (selectMode === true) {
                    var thisnode = $(e.currentTarget).parent().find($(".mailselector"));
                    var id = thisnode.attr("data-mail-id");

                    if (thisnode.hasClass("ui-icon-checkbox-on")) {
                        thisnode.removeClass("ui-icon-checkbox-on");
                        selectedRows = _.without(selectedRows, id);

                    } else {
                        selectedRows.push(id);
                        thisnode.addClass("ui-icon-checkbox-on");
                    }
                    // trigger custom event on document
                    $(events).trigger("listview_select", {
                        folder: thisFolder,
                        internalid: internalid,
                        selectedRows: selectedRows
                    });
                }
                return false;
            });
        }
    };

    var reNumber = function() {
        $.each(listitems, function(i, elem) {
            elem.listpos = i + 1;
        });
    };

    // private removeRow
    var removeRow = function(id) {
        var temp = [];
        var pos = util.findInArray(listitems, "mail", id);

        $.each(listitems, function(i, elem) {
            if(i !== pos) {
                temp.push(elem);
            } else {
                $(elem.node).remove();
            }
        });

        listitems = temp;
        mailcount--;
        if (mailcount === 0) {
            listview.showListEmptyMessage();
        }
        reNumber();
    };

    // private addCustomRom
    var addLoadMoreButton = function(data) {
        loadButtonData = _.clone(data);
        var $item = $("<li>");
        var $btn = $("<button>" + data.text + "</button>")
            .addClass('autoload')
            .bind("touchstart mousedown", function(e) {
                e.preventDefault();
                if (buttonEnabled) {
                    data.action();
                }
            });
        $item.append($btn);
        loadButton = $btn;
        $btn.button();
        node.append($item);
    };

    var enableCheckBoxes = function() {

        $.each(listitems, function(e, elem) {
            var spacer = $(elem.node).find($(".spacer").not(".spacer2"));
            spacer.show();
            $(elem.node).find(".ui-icon-arrow-r").hide();
        });

    };

    var disableCheckBoxes = function() {
        $.each(listitems, function(e, elem) {
            var spacer = $(elem.node).find($(".spacer").not(".spacer2"));
            spacer.hide();
            $(elem.node).find(".ui-icon-arrow-r").show();
        });
    };
    /**
     * show the mail in the list without marker in front and normal
     * font weight
     * @params data {node: DOMNode of listelement as saved in listitems list}
     */
    var showAsRead = function(data) {
        var $node = $(data.node);
        $node.find(".mail-newmail-circle").remove();
        $node.find(".mail-subject-normal, .mail-sender-normal, .mail-overview-date")
            .css("font-weight", "normal !important");
    };
    /**
      * show the mail in the list wit marker in front and bold
     * font weight
     * @params data {node: DOMNode of listelement as saved in listitems list}
     */
    var showAsUnread = function(data) {
        var $node = $(data.node);

        $node.find(".spacer2").append('<div class="mail-newmail-circle">');
        $node.find(".mail-subject-normal, .mail-sender-normal, .mail-overview-date")
            .css("font-weight", "bold !important");
    };

    // private addRow
    var addRow = function(data, method) {

        currentmailcount++;
        var item = $("<li>"),
            link = $("<a>").attr({ href: "#" }),
            $spacer = $("<div>");
        $spacer
            .addClass("spacer")
            .bind("tap", function(e) {
                e.preventDefault();
                e.stopPropagation();
                var thisnode = $(this).children();
                var id = thisnode.attr("data-mail-id");

                if (thisnode.hasClass("ui-icon-checkbox-on")) {
                    thisnode.removeClass("ui-icon-checkbox-on");
                    selectedRows = _.without(selectedRows, id);

                } else {
                    selectedRows.push(id);
                    thisnode.addClass("ui-icon-checkbox-on");
                }
                // trigger custom event on document
                $(events).trigger("listview_select", {
                    folder: thisFolder,
                    internalid: internalid,
                    selectedRows: selectedRows
                });

                return false;
            });
        var $spacer2 = $("<div>").addClass("spacer spacer2");

        var checkbox = $("<span>")
            .addClass("ui-icon ui-icon-checkbox-off ui-icon-shadow mailselector")
            .attr("data-mail-id", data.id)
            .css("border-radius","3px !important")
            .css("margin-left","4px !important");


        $spacer.append(checkbox);

        item.append($spacer).append($spacer2);
        $spacer.hide();

        var $subject = $("<p>").addClass("mail-subject-normal").text(data.subject || _i18n("No subject").toString());

        var $sender = $("<p>")
            .addClass("mail-sender-normal")
            .css({
                position: "relative",
                "padding-right": "24px"
            });
        // is a sender present?
        if (data.sender) {
            $sender.text(data.sender);
        } else {
            $sender.html("&nbsp;");
        }

        var $date = $("<p>").text(data.date).addClass("ui-li-aside mail-overview-date").css("width", "30%");
        var $attachment;

        var bits = data.bits;

        // unread mail?
        if ((bits & 32) == 0) {
            $subject.css("font-weight","bold !important");
            $sender.css("font-weight","bold !important");
            $date.css("font-weight","bold !important");
            $spacer2.append('<div class="mail-newmail-circle">');
        }
        // marked as deleted ?
        if ((bits & 2) != 0) {
            $subject.css("text-decoration","line-through !important");
            $sender.css("text-decoration","line-through !important");
        }


        if (data.attachment) {
            $attachment = $("<div>")
                .addClass("mail_icon_attachment");

            link.append($sender).append($subject).append($date.prepend($attachment));
        } else {
            link.append($sender).append($subject).append($date);
        }

        bindAction(link, data.action);
        item.append(link);

        if (method === "prepend") {
            node.prepend(item);
        } else if (method === "append") {
            node.append(item);
        }
        listitems.push({
            node: $(item),
            mail: data.id,
            listpos: currentmailcount,
            maildata: data
        });
    };
    // private addRows
    var addRows = function(data) {
        for (var i = 0; i < data.length; i++) {
            addRow(data[i], "append");
        }
    };
    // private movebutton
    var moveButtonToEnd = function() {
        removeLoadButton();
        addLoadMoreButton(loadButtonData);
    };

    var removeLoadButton = function() {
        loadButton.closest("li").remove();
        loadButton = null;
    };

    var addMessageToList = function() {
        var $item = $("<li>");
        var $h3 = $("<h4>");

        $h3.text(emptyMessage);
        $item.append($h3);
        node.append($item);
    };

    var displayFolderName = function(folder) {
        var name = mox.mail.folderIDMap[internalid].folder;
        $("#mf_header_" + internalid + " h1").text(name);
    };

    /**
     * find a listitem by mailid
     */
    var findListItem = function(id) {
        var element = null;
        $.each(listitems, function(e, elem) {

            if (elem.mail == id) {
                element = elem;
            }
        });
        return element;
    };

    /**
     * find a listitem by position
     */
    var findListItemByPosition = function(position) {
        var element = null;
        $.each(listitems, function(e, elem) {
            if (elem.listpos == position) {
                element = elem;
            }
        });
        return element;
    };

    // public object
    var listview = {
        hide: function() {
            $(node).css("display", "none");
        },
        show: function(cont) {
           displayFolderName(thisFolder);
           $(node).css("display", "block");
           if(cont) {
               cont();
           }
        },
        getInset : function() {
            return inset;
        },
        setInset : function(setInset) {
            if (newlist === false) {
                _.debug("can not change inset of list after appending listitems");
            } else {
                if (setInset) {
                    inset = setInset;
                    node.attr({
                        "data-inset": "true"
                    });
                } else {
                    inset = false;
                }
            }
        },
        appendDivider: function(data) {
            var item = $("<li>");
            item.text(data.text);
            item.attr("data-role","list-divider");
            node.append(item);
            listitems.push(data);
            this.refresh();
        },
        appendRows: function(dataArray) {
           addRows(dataArray);
           //this.refresh();
        },
        appendRow: function(data) {
            addRow(data, "append");
            //this.refresh();
        },
        prependRow: function(data) {
            addRow(data, "prepend");
            this.refresh();
        },
        deleteRow: function(id) {
            removeRow(id);
            this.refresh();
        },
        deleteRows: function(dataArray) {
            $.each(dataArray, function(i, elem) {
                removeRow(elem);
            });
            this.refresh();
        },
        getItems: function() {
            return listitems;
        },
        getListView : function() {
            return node;
        },
        getLength: function() {
            return listitems.length;
        },
        setActive: function(node) {
            $(node).addClass("ui-icon-checkbox-on");
        },
        setInactive: function(node) {
            $(node).removeClass("ui-icon-checkbox-on");
        },
        setSelectMode: function(state) {
            if(selectMode !== state) {
                selectMode = state;
                if (state === false) {
                    this.unselectAll();
                    disableCheckBoxes();
                    $(events).trigger("listview_select_end", {folder: thisFolder, internalid: internalid});

                    if (loadButton) {
                        loadButton.button("enable");
                        buttonEnabled = true;
                    }
                } else {
                    if (loadButton) {
                        loadButton.button("disable");
                        buttonEnabled = false;
                    }
                    enableCheckBoxes();
                    $(events).trigger("listview_select_start", {folder: thisFolder, internalid: internalid});
                }
            }

        },
        toggleSelectMode: function(whatElseToToggle) {
          this.setSelectMode(!selectMode);
          if (whatElseToToggle) {
              whatElseToToggle.toggle();
          }
        },
        selectAll: function() {
            var self = this;
            $.each(listitems, function(i, elem) {
                // find children with spacer element
                self.setActive($(elem.node).find(".spacer").children());
            });
        },
        unselectAll: function() {
            var self = this;
            $.each(listitems, function(i, elem) {
                // find children with spacer element
                self.setInactive($(elem.node).find(".spacer").children());
            });
            selectedRows.length = 0;
        },
        getSelected: function() {
            return selectedRows;
        },
        refresh: function() {

            if (newlist) {
                node.listview();
                newlist = false;
             } else {
                 node.listview("refresh");
             }
        },
        addLoadMoreButton: function(data) {
            addLoadMoreButton({
                text: data.text,
                action: data.action
            });
        },
        moveLoadMoreButton : function() {
            moveButtonToEnd();
        },
        removeLoadMoreButton : function() {
            removeLoadButton();
        },
        getButton : function() {
            return loadButton;
        },
        setEmptyMessage: function(msg) {
            emptyMessage = msg;
        },
        showListEmptyMessage: function() {
            addMessageToList();
        },
        getFolderID: function() {
            return thisFolder;
        },
        empty: function() {

        },
        getMode: function() {
            return selectMode;
        },
        setMailCount : function(count) {
            mailcount = count;
        },
        getMailCount: function() {
            return mailcount;
        },
        getCurrentMailCount: function() {
            return currentmailcount;
        },
        findListItem: function(id) {
            return findListItem(id);
        },
        findListItemByPosition: function(listposition) {
            return findListItemByPosition(listposition);
        },
        showAsRead: showAsRead,
        showAsUnread: showAsUnread,
        setAsDraftFolder: function(state) {
            isDraftFolder = state;
        },
        isDraftFolder : function() {
            return isDraftFolder;
        }
    };
    return listview;
};

var MailViewer = function() {
    var actualMailShowing = "",
        actualFolder = "",
        detailButtonState = false,
        mailFlag,
        state = '',
        mailList = {};

    // listen to show event
    $(events).bind("maildetail_show", function() {
       var mailListObject = mailList.findListItem(actualMailShowing);
       mailList.showAsRead(mailListObject);
    });

    /**
     * function for "mark" in detail view
     * this just sets the mail as unread
     * @returns
     */
    var markMail = function() {
        var markMail = function (thestate) {

            return function () {
                mox.mail.updateMailFlags([{
                    mailid: actualMailShowing,
                    folder: actualFolder,
                    flag: thestate}], function (e) {
                        state = thestate;
                        if (state === 'unseen') {
                            $('#mail-detail-mark-img').show();
                        } else {
                            $('#mail-detail-mark-img').hide();
                        }
                        // update list from server, everything else does not work
                        mox.mail.updateMailFolders([actualFolder], $.noop);
                });
            };
        };

        var markAsReadButton = {
            text: _i18n("Mark as read").toString(),
            action: markMail('seen')
        };
        var markAsUnreadButton = {
            text: _i18n("Mark as unread").toString(),
            action: markMail('unseen')
        }

        var cancelButton = {
            text: _i18n("Cancel").toString(),
            primary: true,
            action: $.noop
        };

        if (state === "seen") {
            // show overlay
            ui.bottomSelectBox({
                buttons: [markAsUnreadButton, cancelButton],
                method: "click" // tap can effect ghostcklicks
            });
        } else {
            // show overlay
            ui.bottomSelectBox({
                buttons: [markAsReadButton, cancelButton],
                method: "click" // tap can effect ghostcklicks
            });
        }
    };

    /**
     * display the next mail in list
     * @returns
     */
    var nextMail = function() {

        // find id of next mail in list
        var item = mailList.findListItem(actualMailShowing);
        var ownpos = item.listpos;

        var nextpos = ownpos - 1;

        var nextitem = mailList.findListItemByPosition(nextpos);
        var nextid = nextitem.mail;
        mox.mail.getMail({id: nextid}, actualFolder, function(mailobject) {

            $("#itip").hide();
            var itip = new mox.calendar.itip();
            var imipAttachment = itip.discoverIMipAttachment(mailobject);

            if (online && imipAttachment && localUserConfig.activeModules.calendar === true) {
                mailobject.imip = { attachment: imipAttachment };
                itip.analyzeAttachment(mailobject)
                .done(function (analysis) {
                    $("#itip").show();
                    _(analysis).each(function (a, index) {
                        var clone = _.clone(mailobject);
                        clone = $.extend(clone, { analysis: a, index: index });
                        itip.renderAnalysis($("#itip"), clone);
                    });
                })
            }

            mailviewer.drawMail({
                id: nextid, // the view must know which mail it shows
                folder: actualFolder, // the view also knows the folder
                to: mailobject.data.to,
                cc: mailobject.data.cc,
                from: mailobject.data.from,
                text: mailobject.data.attachments[0].content,
                time: formatDate(mailobject.data.received_date, "datetime").toString(),
                subject: mailobject.data.subject,
                themail: mailobject.data,
                imip: imipAttachment
            });
            /* pageloading */
            $(events).trigger("maildetail_show");
        });
    };

    /**
     * display the prev mail in list
     * @returns
     */
    var prevMail = function() {

        // find id of next mail in list
        var item = mailList.findListItem(actualMailShowing);
        var ownpos = item.listpos;

        var nextpos = ownpos + 1;

        var nextitem = mailList.findListItemByPosition(nextpos);
        var nextid = nextitem.mail;

        mox.mail.getMail({id: nextid}, actualFolder, function(mailobject) {

            $("#itip").hide();
            var itip = new mox.calendar.itip();
            var imipAttachment = itip.discoverIMipAttachment(mailobject);

            if (online && imipAttachment && localUserConfig.activeModules.calendar === true) {
                mailobject.imip = { attachment: imipAttachment };
                itip.analyzeAttachment(mailobject)
                .done(function (analysis) {
                    $("#itip").show();
                    _(analysis).each(function (a, index) {
                        var clone = _.clone(mailobject);
                        clone = $.extend(clone, { analysis: a, index: index });
                        itip.renderAnalysis($("#itip"), clone);
                    });
                })
            }

            mailviewer.drawMail({
                id: nextid, // the view must know which mail it shows
                folder: actualFolder, // the view also knows the folder
                to: mailobject.data.to,
                cc: mailobject.data.cc,
                from: mailobject.data.from,
                text: mailobject.data.attachments[0].content,
                time: formatDate(mailobject.data.received_date, "datetime").toString(),
                subject: mailobject.data.subject,
                themail: mailobject.data,
                imip: imipAttachment
            });
            /* pageloading */
            $(events).trigger("maildetail_show");
        });
    };
    // draw the contact as a bubble
    var drawContactBubble = function(container, data) {
        var $container = $(container);
        var $span = $("<div>");
        var text = (data[0] !== null) ? data[0] : data[1];
        $span.append($('<span>').text(text)).addClass("contact-bubble-border");
        $container.append($span);
    };

    var mailviewer = {
        getActualMailShowing: function() {
            return {
                id: actualMailShowing,
                folder: actualFolder
            };
        },
        resetMailView: function() {
            // empty all fields
            $("#mail-detail-time, " +
                    "#mail-detail-from, " +
                    "#mail-detail-subject, " +
                    "#mail-detail-to, " +
                    "#mail-detail-cc, " +
                    "#mail-detail-text").empty();
            $("#mail-detail-detailbutton-img").addClass("down").removeClass("up");
            detailButtonState = false;

        },
        drawMail: function(data, nested) {

            // set state internal
            state = "seen";
            actualFolder = data.folder;
            var index = mox.mail.getFolderFromMap(actualFolder);
            index = index.index;

            $("#maildetail_backbutton").unbind().bind("tap", function(e) {
                e.preventDefault();
                $.mobile.changePage("#mf_" + index, {transition: transitions.slide, reverse: true});
            });
            // remove possible old states
            $(".footer-icon.delete").removeClass("ui-disabled");
            $(".footer-icon.answer").removeClass("ui-disabled");
            $(".footer-icon.move").removeClass("ui-disabled");

            // lookup the maillist for this mail
            mailList = globalMailListViews[data.folder];

            // reset mail view
            this.resetMailView();
            mox.mail.resetAttachments();

            // read mail flag
            mailFlag = data.themail.flags;
            // hide the point
            $("#mail-detail-mark-img").hide();

            // save for next run
            actualMailShowing = data.id;
            actualFolder = data.folder;
            var defaults = {
                attachments: false
            };
            $.extend(data, defaults);
            var actual, listCount, overallCount;
            if (!nested) {
                $(".footer-icon.delete").removeClass("ui-disabled");
                // which mail are we showing
                overallCount = mailList.getMailCount();
                listCount = mailList.getLength();
                actual = mailList.findListItem(actualMailShowing).listpos;
                // show which mail is displayed as number, i.e "5 of 12"
                //#. Displayed in single mail view. This indicates the position of the currently
                //#. displayed mail, i.e. "4 of 10"
                $("#mailDetailTitle").text(format(_i18n("%n of %n"), [actual, overallCount]).toString());
            } else {
                $("#mailDetailTitle").text("");
                // disable delete for this nested message
                $(".footer-icon.delete").addClass("ui-disabled");
                $(".footer-icon.answer").addClass("ui-disabled");
                $(".footer-icon.move").addClass("ui-disabled");
            }
            // the detail button in mail detail
            $("#mail-detail-to, #mail-detail-cc").hide();
            $("#mail-detail-detailbutton").unbind().bind( "tap", function(e) {
                // change pic and view on state
                if (!detailButtonState) {
                    detailButtonState = true;
                    $("#mail-detail-to").show();
                    if (data.cc.length > 0) {
                        $("#mail-detail-cc").show();
                    }
                    $("#mail-detail-detailbutton-img").addClass("up").removeClass("down");
                } else {
                    detailButtonState = false;
                    $("#mail-detail-to").hide();
                    $("#mail-detail-cc").hide();
                    $("#mail-detail-detailbutton-img").addClass("down").removeClass("up");
                }
            });

            $("#mail-detail-to").append(
                    $("<span>").text(_i18n("To:").toString() + " "));

            $("#mail-detail-time").text(data.time);

            // draw clickable contact bubbles
            drawContactBubble("#mail-detail-from", data.from[0]);

            $("#mail-detail-subject").text(data.subject || _i18n("No subject").toString());
            $("#mail-detail-subject").css("text-decoration","none");

            // deleted mail?
            if ((mailFlag & 2) != 0) {
                $("#mail-detail-subject").css("text-decoration","line-through");
            }
            // draw clickable contact bubbles
            $.each(data.to, function(i, item) {
                drawContactBubble("#mail-detail-to", item);
                if (data.to.length > 1 && i < data.to.length){
                    $("#mail-detail-to").append("&nbsp;");
                }
            });
            // draw clickable contact bubbles if cc is set
            if (data.cc.length > 0) {
                $("#mail-detail-cc").append(
                        $("<span>")
                            .text(_i18n("Cc:").toString() + " "));

                $.each(data.cc, function(i, item) {
                    drawContactBubble("#mail-detail-cc", item);
                    if (data.to.length > 1 && i < data.to.length){
                        $("#mail-detail-cc").append("&nbsp;");
                    }
                });
            }

            $("#mail-detail-text").html(data.text);

            // append the text only if it's not imip
//            if (data.imip) {
//                $("#mail-detail-text").empty()
//                .append(
//                    $('<span>').text('Show original mail ...')
//                    .on('click', function() {
//                        $(this).remove();
//                        $('#mail-detail-text div').first().show();
//                    })
//                )
//                .append(
//                    $('<div>').hide().html(data.text)
//                );
//            } else {
//                $("#mail-detail-text").html(data.text);
//            }

            if (data.themail.headers['X-OX-Reminder']
                && localUserConfig.activeModules.calendar === true) {
                var itip = new mox.calendar.itip();
                itip.renderInternalAppointment(data.themail);
            }

            // got a nested message ?
            if (data.themail.nested_msgs && data.themail.nested_msgs.length > 0) {
                var msg;
                $.each(data.themail.nested_msgs, function(index, element) {
                    msg = element;

                    mox.mail.drawAttachments({
                        text: msg.subject,
                        size: "",
                        action: function() {
                            mailviewer.drawMail({
                                id: msg.id, // the view must know which mail it shows
                                folder: actualFolder, // the view also knows the folder
                                to: msg.to,
                                cc: msg.cc,
                                from: msg.from,
                                text: msg.attachments[0].content,
                                time: formatDate(msg.sent_date, "date").toString(),
                                subject: msg.subject,
                                themail: msg
                            }, true);
                        }
                    });

                });
            }

            // attachments will be drawn here
            var attachments;
            if (data.themail.attachment) {
                attachments = data.themail.attachments;
                for (var i = 1; i < attachments.length; i++) {

                    if (isHybridApp && false) {
                        var tid = "attach_" + actualMailShowing + "_" + i;
                        var attach = attachments[i].id;

                        mox.mail.drawAttachments({
                            id: tid,
                            text: attachments[i].filename,
                            size: util.round(attachments[i].size / 1024, 2) + " kB",
                            action: $.noop, //downloader(actualFolder, actualMailShowing, attach, tid),
                            href: "#",
                            actualFolder: actualFolder,
                            actualMailShowing: actualMailShowing,
                            attach: attach,
                            tid: tid

                        });
                    } else {
                        var link = mox.mail.getAttachment(attachments[i].token);
                        mox.mail.drawAttachments({
                            text: attachments[i].filename,
                            size: util.round(attachments[i].size / 1024, 2) + " kB",
                            action: $.noop,
                            href: link
                        });
                    }
                }
            }
            var loadButton = globalMailListViews[actualFolder].getButton();

            // load more mails if we are almost at the bottom of the list
            if ((actual === listCount - 3) && loadButton) {
                // just trigger the loadMoreButton instead of function call
                loadButton.trigger('touchstart');
            }
            // reset possible prev states
            $("#mailup-btn, #maildown-btn").removeClass("ui-disabled");

            // look if this is the first, last or only mail in list
            // and append classes
            if (actual === 1) {
                // disable next button
                $("#mailup-btn").addClass("ui-disabled");
            }

            if (actual === listCount) {
                // diable prev button
                $("#maildown-btn").addClass("ui-disabled");
            }
            if (actual === listCount && actual === 1) {
                // disable both if only one mail in list
                $("#mailup-btn, #maildown-btn").addClass("ui-disabled");
            }
            if (nested) {
                $("#mailup-btn, #maildown-btn").addClass("ui-disabled");
            }
        },
        showNextMail: function() {
            nextMail();
        },
        showPrevMail: function() {
            prevMail();
        },
        markMail: function() {
            markMail();
        },
        getMailList: function() {
            return mailList;
        }
    };

    return mailviewer;
};

// create new instance
var mailviewer = new MailViewer();
/**
 * Class Mail
 */
var Mail = function () {

    var displayName = userData.display_name,
        eMail1 = localUserConfig.senderaddress,
        tos = [ ], cc = [ ], bcc = [ ],
        mailText = "",
        subject = "",
        isDraftEdit = false,
        mailWasSent = false,  // stat of mail object
        CONTENT_TYPE = "text/plain",
        lastPage = "", // remember previous page
        calledFromContactDetail = {
            state: false,
            id: null
        },
        draftMailID;


    var mailObject = {
        from : "",
        to : "",
        cc : "",
        bcc : "",
        subject : "",
        priority : "3",
        vcard : "0",
        attachments : [{
            content_type: CONTENT_TYPE,
            content: ""
        }],
        sendtype: "0"
    };
    // mail is removed from mail
    $(events).bind("newmail_contact_remove", function(e, f) {
        var email = f.email;
        var field = f.field;
        removeRecipient(email,field);
    });

    $(events).bind("contact_selected", function(e, f) {
        var contact = f.fullDataSet,
            email = [],
            displayName = contact.display_name,
            arr = ['to', 'cc', 'bcc'];

        // check mode
        if (!f.meta.contactSelect || $.inArray(f.meta.contactSelect, arr) < 0) {
            return;
        }
//        var retPath = f.meta.contactSelect.substr(0,1).toUpperCase() + f.meta.contactSelect.substr(1);
//        $("#email" + retPath + "Field").trigger("tap");
        _.debug(1, 'contact_selected mail', e, f);

        // check for distribution list
        if ( contact.distribution_list !== null ) {
            var list = contact.distribution_list,
                emailAddress;
            switch (f.meta.contactSelect) {
                case "to":
                    $.each(list, function() {
                        if (displayName !== null) {
                            // use display name if available
                            emailAddress = "\u0022" + this.display_name +"\u0022" + " <" + this.mail + ">";
                        } else {
                            emailAddress = this.mail;
                        }
                        mailfunctions.addTo(emailAddress);
                        mox.mail.addMailRecipient("to", emailAddress, this.display_name || this.mail);
                    });
                    break;
                case "cc":
                    $.each(list, function() {
                        if (displayName !== null) {
                            // use display name if available
                            emailAddress = "\u0022" + this.display_name +"\u0022" + " <" + this.mail + ">";
                        } else {
                            emailAddress = this.mail;
                        }
                        mailfunctions.addCC(emailAddress);
                        mox.mail.addMailRecipient("cc", emailAddress, this.display_name || this.mail);
                    });
                    break;
                case "bcc":
                    $.each(list, function() {
                        if (displayName !== null) {
                            // use display name if available
                            emailAddress = "\u0022" + this.display_name +"\u0022" + " <" + this.mail + ">";
                        } else {
                            emailAddress = this.mail;
                        }
                        mailfunctions.addBCC(emailAddress);
                        mox.mail.addMailRecipient("bcc", emailAddress, this.display_name || this.mail);
                    });
                    break;
            }
            $.mobile.changePage("#newmail", {transition: transitions.slideup, changeHash: false});
            return;
        }

        if (contact.email1) {
            email.push(contact.email1);
        }
        if (contact.email2) {
            email.push(contact.email2);
        }
        if (contact.email3) {
            email.push(contact.email3);
        }
        if (email.length === 1) {

            if (f.meta.contactSelect) {

                var emailAddress;
                if (displayName !== null) {
                    // use display name if available
                    emailAddress = "\u0022" + displayName +"\u0022" + " <" + email[0] + ">";
                } else {
                    emailAddress = email[0];
                }
                switch (f.meta.contactSelect) {
                    case "to":
                        mailfunctions.addTo(emailAddress);
                        mox.mail.addMailRecipient("to", emailAddress, f.text);
                        break;
                    case "cc":
                        mailfunctions.addCC(emailAddress);
                        mox.mail.addMailRecipient("cc", emailAddress, f.text);
                        break;
                    case "bcc":
                        mailfunctions.addBCC(emailAddress);
                        mox.mail.addMailRecipient("bcc", emailAddress, f.text);
                        break;
                }
            }
            $.mobile.changePage("#newmail", {transition: transitions.slideup, reverse: true, changeHash: false});
        } else if (email.length > 1){

            contactviewer.drawMailChoose(f.id, function() {
                $.mobile.changePage("#contactdetail", {transition: transitions.slide, changeHash: false});
            }, function(email, text) {

                var emailAddress;
                if (displayName !== null) {
                    // use display name if available
                    emailAddress = "\u0022" + displayName +"\u0022" + " <"+ email + ">";
                } else {
                    emailAddress = email;
                }

                switch (f.meta.contactSelect) {
                case "to":
                    mox.mail.newMail.addTo(emailAddress);
                    mox.mail.addMailRecipient("to", emailAddress, text);
                    break;
                case "cc":
                    mox.mail.newMail.addCC(emailAddress);
                    mox.mail.addMailRecipient("cc",  emailAddress, text);
                    break;
                case "bcc":
                    mox.mail.newMail.addBCC(emailAddress);
                    mox.mail.addMailRecipient("bcc",  emailAddress, text);
                    break;
                }
                $.mobile.changePage("#newmail", {
                    transition: transitions.slidedown,
                    changeHash: false
                });
            });
        }
    });

    // look for changes or edits
    var changes = function() {
        var t = $("#mail-subject-field").val();
        var k = $("#mail-text-area").val();
        if (isRecipientSet() || t !== "" || k !== "") {
            return true;
        } else {
            return false;
        }
    };

    var reset = function() {
        tos = [ ];
        cc = [ ];
        bcc = [ ];
        mailText = "";
        subject = "";
        mailObject = {
                from : "",
                to : "",
                cc : "",
                bcc : "",
                subject : "",
                priority : "3",
                vcard : "0",
                attachments : [{
                    content_type: CONTENT_TYPE,
                    content: ""
                }],
                sendtype: "0"
        };
        delete(mailObject.flags);
        delete(mailObject.msgref);
        isDraftEdit = false;
        draftMailID = null;

        $("#mail-subject-field").val("");
        $("#mail-text-area").val("");
        mox.mail.resetAttachmentsNewMail();
        mox.mail.clearMailRecipients();
    };

    var isRecipientSet = function() {
        if ((tos.length + cc.length + bcc.length) > 0) {
            return true;
        } else {
            return false;
        }
    };

    // update the mail object with inputs from user
    var updateMailObject = function() {
        mailObject.from = "\u0022" + displayName + "\u0022 <" + eMail1 + ">";
        mailObject.to = tos.toString();
        mailObject.cc = cc.toString();
        mailObject.bcc = bcc.toString();
        mailObject.subject = subject;
        mailObject.attachments[0].content = mailText;
    };
    // edit a mail draft
    var editDraftMail = function(mail, options) {
        isDraftEdit = true;
        draftMailID = options;
        var data = mail.data;

        mailObject.sendtype = "4";
        mailObject.msgref = (data.msgref !== undefined) ? data.msgref : data.folder_id + "/" + data.id;

        $.each(data.to, function(i, elem) {
            if (elem[0] && elem[1]) {
                mox.mail.addMailRecipient("to", elem[1], elem[0]);
                mailfunctions.addTo(elem[1]);
            } else {
                mox.mail.addMailRecipient("to", elem[1], elem[1]);
                mailfunctions.addTo(elem[1]);
            }
        });
        $.each(data.cc, function(i, elem) {
            if (elem[0] && elem[1]) {
                mox.mail.addMailRecipient("cc", elem[1], elem[0]);
                mailfunctions.addCC(elem[1]);
            } else {
                mox.mail.addMailRecipient("cc", elem[1], elem[1]);
                mailfunctions.addCC(elem[1]);
            }
        });
        var hasbcc = false;
        $.each(data.bcc, function(i, elem) {
            hasbcc = true;
            if (elem[0] && elem[1]) {
                mox.mail.addMailRecipient("bcc", elem[1], elem[0]);
                mailfunctions.addBCC(elem[1]);
            } else {
                mox.mail.addMailRecipient("bcc", elem[1], elem[1]);
                mailfunctions.addBCC(elem[1]);

            }
        });

        if (hasbcc) {
            // in case of bcc's set, show them when mail
            // page opens
            $("#newmail").one("pageshow", function() {
                $("#newmail-bcc-table").show();
            });
        }

        // get reformated text
        var draftText = reformatText(data.attachments[0].content);
        // set subject and text
        $("#mail-subject-field").val(data.subject);
        $("#mail-text-area").val(draftText);
    };

    // save a mail as draft on backend
    var saveDraft = function(callback, options) {
       var defaults = $.extend({ flags: '4'}, options);

       $.extend(mailObject, defaults);

       subject = $("#mail-subject-field").val();
       mailText = nl2br($("#mail-text-area").val());

       updateMailObject();

       if (online) {
           sendMail(function() {
               reset();
               callback();
           }, {silent: true});
       } else {

           mox.mail.drafts.addDraft({
               to: tos,
               cc: cc,
               bcc: bcc,
               subject: subject,
               from: displayName,
               attachments : [{
                   content_type: "TEXT/PLAIN",
                   content: mailText
               }]
           });
           reset();
           callback();
       }
    };

    var sendMail = function(callback, options) {
        // send the mail via ajax POST
        // we need to build the multipart/form-data content by hand

        if (!isRecipientSet()) {
            ui.showAlertBox(_i18n("No recipient set").toString(), {buttons: [{
                text: _i18n("Ok").toString(),
                action: function() {
                    }
                }
             ]});
        }

        var defaults = {silent: false};
        $.extend(defaults, options);

        var boundary = "--FormBoundary" + util.randomString(20);
        var br = "\r\n";
        var contentDispo = 'Content-Disposition: form-data; name="json_0"\r\n\r\n';
        var data = boundary + br + contentDispo + JSON.stringify(mailObject) + br + boundary + "--";

        var success = function(e) {
            /* pageloading */
            if (e.match("parent.callback_new")) {
                if (e.match("error")) {
                    // search error string in callback
                    var errorString = e.match(/{([^}]*)}/)[0];
                    // parse to json
                    var err = JSON.parse(errorString);
                    // handle error
                    ui.showAlertBox(_i18n("An error occurred").toString(), {buttons: [{
                        text: _i18n("Ok").toString(),
                        action: function() {
                            }
                        }
                     ]});
                } else {
                    // mail sent
                    mailWasSent = true;
                    reset();
                    // only show message if we want it. In draft mode don't show this message
                    if ( defaults.silent === false ) {

                        ui.showAlertBox(_i18n("Your mail was sent").toString(), {buttons: [{
                            text: _i18n("Ok").toString(),
                            action: function() {
                                    $(events).trigger("refresh");
                                    $.mobile.changePage(lastPage, {transition: transitions.slidedown});
                                    lastPage = "";
                                }
                            }
                         ]});
                    }
                    if (callback) {
                        callback();
                    }
                }
            } else if (e.match("parent.callback_error")) {
                if (e.match("error")) {
                    // search error string in callback
                    var errorString = e.match(/{([^}]*)}/)[0];
                    // parse to json
                    var err = JSON.parse(errorString);
                    // handle error
                    //callback_error(err);
                    ui.showAlertBox(_i18n("An error occurred").toString(), {buttons: [{
                        text: _i18n("Ok").toString(),
                        action: function() {
                            }
                        }
                     ]});
                }
            } else {
                // error occurred
                //parse text to json
                var data = JSON.parse(e);
                // handle error
                if(data.error) {
                    mox.error.handleError(data);
                }
            }
        }; // end successhandler

        $.ajax({
            url: HOST +"/mail?action=new&session=" + session,
            type: "post",
            data: data,
            success: success,
            error: mox.error.handleError,
            contentType: "multipart/form-data; boundary=" + boundary.substr(2),
            dataType: "text"
        });
    };

    var removeRecipient = function(email, field) {
       if (field === "to") {
           tos = _.without(tos, email);
       } else if (field === "cc") {
           cc = _.without(cc, email);
       } else if (field === "bcc") {
           bcc = _.without(bcc, email);
       } else {
           return false;
       }
    };

    /**
     * reformat the text given from backend
     * to fill textarea with correct line breaks
     */
    var reformatText = function(data) {
        var text = "";
        $('<div>').html(data.replace(/<(?!br)/gi, '&lt;'))
                .contents().each(function () {
                    if (this.tagName === 'BR') {
                        text += "\n";
                    } else {
                        text += $(this).text();
                    }
                });
        text = $.trim(text);
        return text;
    };


    /**
     * replyMail
     * reply to a mail
     * @param mail Object {id:XXX, folder: XXX}
     * @param replyall Boolean
     * @param callback Function
     */
    var replyMail = function(mail, replyall, callback) {
        reset();

        mailWasSent = false;
        var action = (replyall === true) ? "replyall" : "reply";
        var id = mail.id;
        var folder = mail.folder;

        var url = HOST + "/mail";
        var data = {
                "action": action,
                "id": id,
                "session":session,
                "folder":folder,
                "view":"text"
        };

        var successHandler = function(mailData, response, error) {
            if (mailData.error) {
                mox.error.handleError(mailData);
            } else {
                var recp = "";
                var ccs = "";
                $.each(mailData.data.to, function(i, elem) {
                    if (elem[0] && elem[1]) {
                        mox.mail.addMailRecipient("to", elem[1], elem[0]);
                        mailfunctions.addTo(elem[1]);
                    } else {
                        mox.mail.addMailRecipient("to", elem[1], elem[1]);
                        mailfunctions.addTo(elem[1]);
                    }
                });
                $.each(mailData.data.cc, function(i, elem) {
                    if (elem[0] && elem[1]) {
                        mox.mail.addMailRecipient("cc", elem[1], elem[0]);
                        mailfunctions.addCC(elem[1]);
                    } else {
                        mox.mail.addMailRecipient("cc", elem[1], elem[1]);
                        mailfunctions.addCC(elem[1]);
                    }
                });
                // get reformated text and prepend tow empty rows for typing
                var replyText = "\n\n" + reformatText(mailData.data.attachments[0].content);
                // set subject and text
                $("#mail-subject-field").val(mailData.data.subject);
                $("#mail-text-area").val(replyText);

                if (callback) {
                    callback();
                }
            }
        };

        $.ajax({
            url: url,
            data:data,
            success: successHandler,
            error: mox.error.handleError,
            type: "get",
            dataType: "json"
        });
    };

    /**
     * forwardMail
     * reply to a mail
     * @param mail Object {id:XXX, folder: XXX}
     * @param replyall Boolean
     * @param callback Function
     */
    var forwardMail = function(mail, callback) {
        reset();

        mailWasSent = false;
        var id = mail.id;
        var folder = mail.folder;

        var url = HOST + "/mail";
        var data = {
            action: "forward",
            id: id,
            session: session,
            folder: folder,
            view: "text"
        };

        var successHandler = function(mailData, response, error) {
            if (mailData.error) {
                mox.error.handleError(mailData);
            } else {
                // set subject and text
                $("#mail-subject-field").val(mailData.data.subject);

                mailObject.sendtype = 2;
                mailObject.msgref = mailData.data.msgref;
                var att = mailData.data.attachments;
                if (att.length > 1) {
                    for (var k = 1; k < att.length; k++) {
                        mailObject.attachments.push(att[k]);
                        mox.mail.drawAttachmentNewMail({
                            text: att[k].filename,
                            size: util.round(att[k].size / 1024, 2) + " kB"
                        });
                    }
                }

                if (mailData.data.nested_msgs && mailData.data.nested_msgs.length > 0) {
                    var i, nobj, textAttachment;
                    for (i = 0; i < mailData.data.nested_msgs.length; i++) {

                        nobj = mailData.data.nested_msgs[i];
                        textAttachment = nobj.subject || _i18n("attachment").toString();

                        mailObject.attachments.push({
                            id: nobj.id || "message/rfc822",
                            filename: textAttachment,
                            size: null,
                            content_type: "message/rfc822",
                            msgref: nobj.msgref || null
                        });
                        mox.mail.drawAttachmentNewMail({text: textAttachment, size: ""});
                    }
                } else {
                    // get reformated text
                    var replyText = "\n\n" + reformatText(mailData.data.attachments[0].content);
                    $("#mail-text-area").val(replyText);
                }

                if (callback) {
                    callback();
                }
            }
        };

        $.ajax({
            url: url,
            data:data,
            success: successHandler,
            error: mox.error.handleError,
            type: "get",
            dataType: "json"
        });
    };
    var mailfunctions = {
        addTo: function(data) {
            tos.push(data);
        },
        addCC: function(data) {
            cc.push(data);
        },
        addBCC: function(data) {
            bcc.push(data);
        },
        getTos: function() {
            return tos;
        },
        getCCs: function() {
            return cc;
        },
        getBCCs: function() {
            return bcc;
        },
        removeRecipient: function(email, field) {
            return removeRecipient(email, field);
        },
        setSubject : function(sub) {
            subject = sub;
        },
        getSubject: function() {
            return subject;
        },
        setMailText: function(text) {
            mailText = text;
        },
        sendMail: function(callback, options) {
            updateMailObject();
            sendMail(callback, options);
        },
        getState: function() {
            return mailWasSent;
        },
        reset: function() {
            reset();
            mailWasSent = false;
        },
        replyMail: function(mail, replyall, callback) {
            replyMail(mail, replyall, callback);
        },
        forwardMail: function(mail, callback) {
            forwardMail(mail, callback);
        },
        isRecipientSet: function() {
            return isRecipientSet();
        },
        saveDraft: function(callback) {
            saveDraft(callback);
        },
        editDraftMail: function(mail, options) {
            editDraftMail(mail, options);
        },
        inputPerformed: function() {
            return changes();
        },
        isDraftEdit: function() {
            return isDraftEdit;
        },
        setLastPage: function(page) {
            lastPage = page;
        },
        getLastPage: function() {
            return lastPage;
        },
        getMailObject: function() {
            return mailObject;
        },
        getDraftID: function () {
            return draftMailID;
        },
        calledFromContactDetail: calledFromContactDetail
    };

    return mailfunctions;
};
/**
 * class Drafts
 * saves offline drafts for later sync to Backend
 * @returns
 */
var Drafts = function() {
    var draftlist = { };
    var internalID = 0;
    var draftsListView = globalMailListViews[localUserConfig.folderTree.standardMailFolders["2_drafts"].id];
    
    $(events).bind("online", function() {
        if (count() > 0 ) {
            pushToServer();
        }
    });
    
    var prepareObject = function (raw) {
        var draft = {
            data: raw,
            timestamp: new Date().getTime()
        };
        return draft;
    };
    
    var addDraft = function(data) {
        var obj = prepareObject(data);
        draftlist[internalID] = obj;
       
        try {
            storage.setItem("drafts", draftlist, true);
        } catch (e) {
            // handle storage error
        }
        // add to drafts maillistview 
        draftsListView.prependRow({
            id: "x",
            folder: "x",
            subject: obj.data.subject || "",
            sender: obj.data.from,
            date: util.date.formatDate(obj.timestamp ,"date"),
            bits: 32,
            attachment: false,
            action: { draftid: internalID}
        });
        try { 
            draftsListView.refresh();
        } catch (e) {
            
        }
        try {
            draftsListView.create();
        } catch(e) {
        }
        
        internalID++;
    };
    
    var count = function() {
        var i = 0;
        $.each(draftlist, function() {
            i++;
        });
        return i;
    };
    
    var restoreDrafts = function() {
        try {
            draftlist = storage.getItem("drafts", true);
        } catch(e) {
            // errror
        }
    };
    
    var functions = {
        addDraft: function(data) {
            addDraft(data);
            return internalID-1;
        },
        getDraftsList: function() {
            return draftlist;
        },
        getLength: function() {
            return count();
        },
        pushToServer: function() {
            _.debug("pushing to drafts to server");
        },
        getDraft: function(id) {
            return draftlist[id];
        },
        clearDraftsList: function() {
            draftlist = { };
        },
        removeDraft: function(id) {
            delete(draftlist[id]);
        },
        restoreDrafts: function() {
            restoreDrafts();
        }
    };
    return functions;
};
/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

/**
 * Class ListView
 * @param container
 * @returns
 */
var ContactListView = function (container, folderName, contacts) {
    _.debug('new ContactListView', contacts);

    var emptyMessage = _i18n("Contact list is empty.").toString(),
        lastPage = "",
        thisFolder = folderName,
        selectMode = false,
        metaData = {},
        $container = $('#'+container),
        $node = $("<ul>")
            .attr({
                "data-role": "listview",
                "data-filter": "true",
                "data-filter-placeholder": _i18n("Search for contacts...").toString()
            });

    // main
    // empty $node
    $container
        .empty()
        .append($node);

    var extractData = function(data) {
        var defaultData = {
            id: data[0],
            name: "",
            lastname: "",
            displayname: ""
        };

        // this sorting must match the backends sorting column 607
        if (data[3] && data[2]) {
            defaultData.name = data[2];
            defaultData.lastname = data[3];
            defaultData.displayname = data[3] + ", " + data[2] ; // last name, first name
        } else if (data[1]) {
            defaultData.displayname = data[1]; // only displayname
        } else if (data[3]) {
            defaultData.displayname = data[3]; // only lastname
        } else if (data[2]) {
            defaultData.displayname = data[2]; // only firstname
        } else if (data[11]) {
            defaultData.displayname = data[11]; // company
        } else if (data[4]) {
            defaultData.displayname = data[4]; // first email
        } else if (data[20]) {
            defaultData.displayname = data[20]; // second email
        }

        // add all email addresses to global mail list
        // for autocomplete
        mox.contacts.addToGlobalEmailList(data, defaultData.displayname);

        return defaultData;
    };

    var searchFilterExtract = function(data) {
        // fields to use
       var fields = [1,11,15,16,2,20,21,3,4,8,9];
       var extract = "";
       for (var i = 0; i < fields.length; i++) {
           extract += (data[fields[i]] !== null ? data[fields[i]] + ' ' : '');
       }
       return $.trim(extract);
    };

    var showEmptyMessage = function() {
        $node
            .empty()
            .append($("<li>").text(emptyMessage));
    };

    // delegate for tap events
    $('ul', '#contacts-content').on('click', 'li', function (e) {
        var id = $(this).find('a').attr('value');

        if (id === undefined) return;

        e.preventDefault();

        if (!selectMode) {
            contactviewer.drawContact(id, function() {
                $.mobile.changePage("#contactdetail", {transition: transitions.slide});
            });
        } else {
            // this is the text shown in list.
            // This string will be passed around with the select event
            // to show the name in the new mail form
            var nameInList = ($(this).text());
            // trigger event which contact was selected
            $(events).trigger("contact_selected", {
                id: id,
                text: nameInList,
                meta: metaData,
                fullDataSet: mox.contacts.getContactByID(id)
            });
        }
    });

    // private addRow
    var addRow = function(contact, method) {
        $node[method](getRow(contact));
    };

    // private getRow
    var getRow = function(contact) {
        var data = extractData(contact);
        return '<li data-filtertext="' + searchFilterExtract(contact) + '"><a href="#" value="' + data.id + '">' +
            (data.displayname === '' ? '&nbsp;' : util.escapeHTML(data.displayname)) +
            '</a></li>';
    };

    var addMessageToList = function() {
        $node.append($("<li>").append($("<h4>").text(emptyMessage)));
    };

    var switchButtonLayoutInToolbar = function() {
        if (selectMode) {
           $("#contacts .custom-backbutton, #addcontactsbutton").hide();
           $("#cancelcontactsbutton").show();
        } else {
            $("#contacts .custom-backbutton, #addcontactsbutton").show();
            $("#cancelcontactsbutton").hide();
        }
    };

    var resetList = function() {
        $node.empty();
    };

    var getDivider = function(text) {
        return '<li class="contactlist-separator-bg" data-role="list-divider">' +
            util.escapeHTML(text) +
            '</li>';
    };

    var updateData = function(list) {
        if (list) {
            // used for sorting
            var firstChar = '',
                tempChar = '',
                items = '';
            if (list.order) {
                for (var i = 0; i < list.order.length; i++) {
                    var elem = list[list.order[i]];

                    // get first char of surname
                    var lastname = elem[3] || "",
                        firstname = elem[2] || "",
                        displayname = elem[1] || "",
                        email1 = elem[4] || "",
                        email2 = elem[20] || "",
                        company = elem[11] || "";

                    // this sorting must match the backends sorting column 607
                    if (lastname !== "") {
                        tempChar = lastname;
                    } else if (displayname !== "") {
                        tempChar = displayname;
                    } else if (firstname !== "") {
                        tempChar = firstname;
                    } else if (company !== "") {
                        tempChar = company;
                    } else if (email1 !== "") {
                        tempChar = email1;
                    } else if (email2 !== "") {
                        tempChar = email2;
                    } else {
                        tempChar = '0'; // fallback
                    }
                    tempChar = tempChar[0].toUpperCase();
                    if (tempChar.match(/^[^a-zA-Z]/)) {
                        tempChar = "123";
                    }
                    if (firstChar !== tempChar) {
                        items += getDivider(tempChar);
                    }
                    firstChar = tempChar;

                    // let the listview decide what to show
                    items += getRow(elem);
                }
            }
            $node.append(items);
        }
    };

    // public object
    var listview = {
        show: function(cont) {
            $container
                .show()
                .siblings()
                .hide();
            if(cont) {
                cont();
            }
        },
        appendDivider: function(data) {
            addDivider(data);
        },
        appendRow: function(data) {
            addRow(data, "append");
        },
        appendRows: function(dataArray) {
            for (var i = 0; i < data.length; i++) {
                addRow(data[i], "append");
            }
        },
        prependRow: function(data) {
            addRow(data, "prepend");
        },
        deleteRow: function(id) {
            removeRow(id);
        },
        deleteRows: function(dataArray) {
            $.each(dataArray, function(i, elem) {
                removeRow(elem);
            });
        },
        getListView : function() {
            return $node;
        },
        setEmptyMessage: function(msg) {
            emptyMessage = msg;
        },
        showListEmptyMessage: addMessageToList,
        getFolderID: function() {
            return thisFolder;
        },
        setSelectMode: function(state) {
            selectMode = state;
            switchButtonLayoutInToolbar();
        },
        getSelectMode: function() {
            return selectMode;
        },
        setSelectMetaData: function(data) {
            metaData = data;
        },
        getSelectMetaData: function() {
            return metaData;
        },
        update: function(ob) {
            this.reset();
            updateData(ob);
            this.refresh();
        },
        refresh: function() {
            if ($node.hasClass('ui-listview')) {
                $node.listview('refresh');
            }
        },
        showEmptyMessage: showEmptyMessage,
        reset: resetList,
        setLastPage: function(page) {
            lastPage = page;
        },
        getLastPage: function() {
            return lastPage;
        }
    };

    updateData(contacts);
    switchButtonLayoutInToolbar();

    return listview;
};

var ContactViewer = function() {
    var actualContactShowing = "";
    var mailSelectMode = false;
    var wasInited = false;
    var $completeName = $("<div>").addClass("contact-detail-label bold");
    var $company = $("<div>").addClass("contact-detail-label");
    
    var clearPage = function() {
        $("#contact-detail-image-container").empty().removeClass("dummy realimg");
        $("#contact-detail-container, #contact-main-detail-container").empty();
    };
    
    var setContactImage = function(url) {
        if (url === "default") {
            $("#contact-detail-image-container").addClass("dummy");
        } else {
            $("#contact-detail-image-container")
                .append($("<img>").attr("src", HOSTONLY + url).addClass("maxwidth"))
                .addClass("contact-detail-image-container realimg");
        }
    };
    
    var createList = function() {
        return $("<ul>").attr({
            "data-role" : "listview",
            "data-inset" : "true"
        });
    };
    
    var drawMailChoose = function(id, cb, action) {
        
        clearPage();
        actualContactShowing = id;
        cD = mox.contacts.getContactByID(id);
        var displaytext = '';
        
        $('#editcontactsbutton').hide();

        // names
        if (cD.first_name && cD.last_name) {
            displaytext = cD.last_name + ", " + cD.first_name;
        } else if (cD.display_name) {
            displaytext = cD.display_name;
        } else if (cD.last_name) {
            displaytext = cD.last_name;
        } else if (cD.first_name) {
            displaytext = cD.first_name;
        } else if (cD.email1){
            displaytext = cD.email1;
        }
  
        
        $completeName.text(displaytext);
        $("#contact-main-detail-container").append($completeName);
        
        // company 
        if (cD.company) {
            $company.text(cD.company);
            $("#contact-main-detail-container").append($company).css("");
        }
        // contact image
        if (cD.image1_url) {
            setContactImage(cD.image1_url);
        } else {
            setContactImage("default");
        }
        
        var allLists = [];
        var $list2;
        
        // display emails next
        if (cD.email1 || cD.email2 || cD.email3 ) {
                
            $list2 = createList();
            allLists.push($list2);

            if (cD.email1) {
                var $mail1 = $("<li>");
                var $maillabel1 = $("<span>").addClass("contact-detail-list-label").text(_i18n("E-Mail").toString());
                $mail1.append($maillabel1).append(
                        $("<a>").attr({
                            "href" : "#"
                        }).addClass("contact-detail-list-color").text(cD.email1)
                        .bind("tap", function(e) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            if (online) {
                                action(cD.email1, displaytext);
                            } else {
                                ui.showOfflineMessage();
                            }
                        }));
                
                $list2.append($mail1);
            }
            
            if (cD.email2) {
                var $mail2 = $("<li>");
                var $maillabel2 = $("<span>").addClass("contact-detail-list-label").text(_i18n("E-Mail 2").toString());
                $mail2.append($maillabel2).append(
                        $("<a>").attr({
                            "href" : "#"
                        }).addClass("contact-detail-list-color").text(cD.email2)
                        .bind("tap", function(e) {
                            e.preventDefault();
                            if (online) {
                                action(cD.email2, displaytext);
                            } else {
                                ui.showOfflineMessage();
                            }
                        }));
                
                $list2.append($mail2);
            }
            
            if (cD.email3) {
                var $mail3 = $("<li>");
                var $maillabel3 = $("<span>").addClass("contact-detail-list-label").text(_i18n("E-Mail 3").toString());
                $mail3.append($maillabel3).append(
                        $("<a>").attr({
                            "href" : "#"
                        }).addClass("contact-detail-list-color").text(cD.email3)
                        .bind("tap", function(e) {
                            e.preventDefault();
                            if (online) {
                                action(cD.email3, displaytext);
                            } else {
                                ui.showOfflineMessage();
                            }
                        }));
                
                $list2.append($mail3);
            }
            
        } // end email block
        $.each(allLists, function(e, f) {
            $("#contact-detail-container").append($(f));
            // jqm mobile stuff
            // we can only trigger the create on the list if
            // it was not inited by the page before.
            // This usally happens on the first time the contact detail page
            // is visited. After this we need to trigger the listview() by
            // ourselfs
            if (wasInited) {
                $(f).listview();
            }
        });

        // callback
        if (cb) {
            cb();
        }
    };
    
    var drawContact = function(id, cb) {
        clearPage();
        actualContactShowing = id;
        cD = mox.contacts.getContactByID(id);
        
        // special handling for distribution lists and user rights
        var $editButton = $('#editcontactsbutton'),
            permisson = util.getPermission(mox.contacts.contactFolders[cD.folder_id].data[7], 14).bit,
            editable = permisson >= 2 || (permisson == 1 && cD.created_by == userID);
        
        // contact image
        if (cD.image1_url) {
            setContactImage(cD.image1_url);
        } else {
            setContactImage("default");
        }
        
        $editButton
            .show();
        if ( cD.distribution_list !== null || !editable ) {
            $editButton
                .addClass('ui-disabled');
            if ( cD.distribution_list !== null ) {
                drawDistributionList(cD, { callback : cb});
                return;
            }
        } else {
            $editButton
                .removeClass('ui-disabled');
        }
        
        var displaytext = '';
        
        // names
        if (cD.first_name && cD.last_name) {
            displaytext = cD.last_name + ", " + cD.first_name;
        } else if (cD.display_name) {
            displaytext = cD.display_name;
        } else if (cD.last_name) {
            displaytext = cD.last_name;
        } else if (cD.first_name) {
            displaytext = cD.first_name;
        } else if (cD.email1){
            displaytext = cD.email1;
        }
        
        $completeName.text(displaytext);
        $("#contact-main-detail-container").append($completeName);
        
        // company 
        if (cD.company) {
            $company.text(cD.company);
            $("#contact-main-detail-container").append($company).css("");
        }
        
        var allLists = [];
        var $list;
        
        
        // all phonenumbers are on the top
        if ( cD.telephone_home1 ||
                cD.cellular_telephone2 ||
                cD.telephone_business1 ||
                cD.cellular_telephone1 ) {
            
            $list = createList();
            allLists.push($list);
            if (cD.cellular_telephone1 ) {
                var $tel4 = $("<li>");
                var label4 = $("<span>").addClass("contact-detail-list-label").text(_i18n("Mobile").toString());
                $tel4.append(label4).append(
                        $("<a>").addClass("contact-detail-list-color").attr({
                            "href" : "tel:" + cD.cellular_telephone1.replace(/[a-zA-Z]/g, "") // remove chars from number
                        }).text(cD.cellular_telephone1));
                
                $list.append($tel4);
            }
            
            if ( cD.telephone_home1 ) {
                var $tel1 = $("<li>");
                var label1 = $("<span>").addClass("contact-detail-list-label").text(_i18n("Private").toString());
                $tel1.append(label1).append(
                        $("<a>").addClass("contact-detail-list-color").attr({
                            "href" : "tel:" + cD.telephone_home1.replace(/[a-zA-Z]/g, "") // remove chars from number
                        }).text(cD.telephone_home1));
                
                $list.append($tel1);
            }
            
            if (cD.cellular_telephone2  ) {
                var $tel2 = $("<li>");
                var label2 = $("<span>").addClass("contact-detail-list-label").text(_i18n("Mobile 2").toString());
                $tel2.append(label2).append(
                        $("<a>").addClass("contact-detail-list-color").attr({
                            "href" : "tel:" + cD.cellular_telephone2 .replace(/[a-zA-Z]/g, "")
                        }).text(cD.cellular_telephone2 ));
                
                $list.append($tel2);
            }
            
            if (cD.telephone_business1 ) {
                var $tel3 = $("<li>");
                var label3 = $("<span>").addClass("contact-detail-list-label").text(_i18n("Business").toString());
                $tel3.append(label3).append(
                        $("<a>").addClass("contact-detail-list-color").attr({
                            "href" : "tel:" + cD.telephone_business1.replace(/[a-zA-Z]/g, "")
                        }).text(cD.telephone_business1));
                
                $list.append($tel3);
            }
        } // end phonenumber block
        
        var $list2;
        
        // display emails next
        if (cD.email1 || cD.email2 || cD.email3 ) {
                
            $list2 = createList();
            allLists.push($list2);
            
            if (cD.email1) {
                var $mail1 = $("<li>");
                var $maillabel1 = $("<span>").addClass("contact-detail-list-label").text(_i18n("E-Mail").toString());
                $mail1.append($maillabel1).append(
                        $("<a>").attr({
                            "href" : "#"
                        }).addClass("contact-detail-list-color").text(cD.email1)
                        .bind("tap", function(e) {
                            e.preventDefault();
                            if (online) {
                                mox.mail.newMail.addTo(cD.email1);
                                mox.mail.addMailRecipient("to", cD.email1, cD.email1);
                                
                                mox.mail.newMail.calledFromContactDetail.id = actualContactShowing;
                                mox.mail.newMail.calledFromContactDetail.state = true;
                                
                                $.mobile.changePage("#newmail", {transition: transitions.slideup, changeHash: false});
                                mox.mail.newMail.setLastPage("#contactdetail");
                            } else {
                                ui.showOfflineMessage();
                            }
                        }));
                
                $list2.append($mail1);
            }
            
            if (cD.email2) {
                var $mail2 = $("<li>");
                var $maillabel2 = $("<span>").addClass("contact-detail-list-label").text(_i18n("E-Mail 2").toString());
                $mail2.append($maillabel2).append(
                        $("<a>").attr({
                            "href" : "#"
                        }).addClass("contact-detail-list-color").text(cD.email2)
                        .bind("tap", function(e) {
                            e.preventDefault();
                            if (online) {
                                mox.mail.newMail.addTo(cD.email2);
                                mox.mail.addMailRecipient("to", cD.email2, cD.email2);
                                
                                mox.mail.newMail.calledFromContactDetail.id = actualContactShowing;
                                mox.mail.newMail.calledFromContactDetail.state = true;
                                
                                $.mobile.changePage("#newmail", {transition: transitions.slideup, changeHash: false});
                                mox.mail.newMail.setLastPage("#contactdetail");
                            } else {
                                ui.showOfflineMessage();
                            }
                        }));
                
                $list2.append($mail2);
            }
            
            if (cD.email3) {
                var $mail3 = $("<li>");
                var $maillabel3 = $("<span>").addClass("contact-detail-list-label").text(_i18n("E-Mail 3").toString());
                $mail3.append($maillabel3).append(
                        $("<a>").attr({
                            "href" : "#"
                        }).addClass("contact-detail-list-color").text(cD.email3)
                        .bind("tap", function(e) {
                            e.preventDefault();
                            if (online)  {
                                mox.mail.newMail.addTo(cD.email3);
                                mox.mail.addMailRecipient("to", cD.email3, cD.email3);
                                
                                mox.mail.newMail.calledFromContactDetail.id = actualContactShowing;
                                mox.mail.newMail.calledFromContactDetail.state = true;
                                
                                $.mobile.changePage("#newmail", {transition: transitions.slideup, changeHash: false});
                                mox.mail.newMail.setLastPage("#contactdetail");
                            } else {
                                ui.showOfflineMessage();
                            }
                        }));
                $list2.append($mail3);
            }
        } // end email block
        
        // private address
        if (cD.street_home || cD.postal_code_home || cD.city_home) {
            var $privAddList = createList();
            var addressObj = { };
            var $privateAddress = $("<li>");
            var $privateAddressLabel = $("<span>").addClass("contact-detail-list-label").text(_i18n("Privat").toString());
            $privateAddress.append($privateAddressLabel);
            var add = [];
            if (cD.street_home) {
                addressObj.street = cD.street_home;
                add.push($("<div>").addClass("contact-detail-address contact-detail-list-color").text(cD.street_home));
            }
            if (cD.postal_code_home) {
                addressObj.zip = cD.postal_code_home;
                add.push($("<div>").addClass("contact-detail-address contact-detail-list-color").text(cD.postal_code_home));
            }
            if (cD.city_home) {
                addressObj.town = cD.city_home;
                add.push($("<div>").addClass("contact-detail-address contact-detail-list-color").text(cD.city_home));
            }
            var $link = $("<a>").attr("href","#");
            $.each(add, function(e, f) {
                $link.append(f);
            });
            $privAddList.append($privateAddress.append($link));
            
            // enable google maps
            $privAddList.bind("tap", function(e) {
                e.preventDefault();
                if (online) {
                    /* pageloading */
                    $(events).bind("maps-map-ready", function() {
                        /* pageloading */
                        $.mobile.changePage("#maps", {transition: transitions.slide, changeHash: false});
                        $(events).unbind("maps-map-ready");
                    });
                    mox.maps.drawMap(addressObj);
                } else {
                    ui.showOfflineMessage();
                }
            });
            
            
            allLists.push($privAddList);
        }
        // business address
        if (cD.street_business || cD.postal_code_business || cD.city_business) {
            var $bizAddList = createList();
            var addressObj2 = { };
            var $bizAddress = $("<li>");
            var $bizAddressLabel = $("<span>").addClass("contact-detail-list-label").text(_i18n("Business").toString());
            $bizAddress.append($bizAddressLabel);
            var bizadd = []; // weird var name...
            if (cD.street_business) {
                addressObj2.street = cD.street_business;
                bizadd.push($("<div>").addClass("contact-detail-address contact-detail-list-color").text(cD.street_business));
            }
            if (cD.postal_code_business) {
                addressObj2.zip = cD.postal_code_business;
                bizadd.push($("<div>").addClass("contact-detail-address contact-detail-list-color").text(cD.postal_code_business));
            }
            if (cD.city_business) {
                addressObj2.town = cD.city_business;
                bizadd.push($("<div>").addClass("contact-detail-address contact-detail-list-color").text(cD.city_business));
            }
            var $bizlink = $("<a>").attr("href","#");
            $.each(bizadd, function(e, f) {
                $bizlink.append(f);
            });
            
           
         // enable google maps
            $bizAddList.bind("tap", function(e) {
                e.preventDefault();
                if (online) {
                /* pageloading */
                $(events).bind("maps-map-ready", function() {
                    /* pageloading */
                    $.mobile.changePage("#maps", {transition: transitions.slide, changeHash: false });
                    $(events).unbind("maps-map-ready");
                });
                mox.maps.drawMap(addressObj2);
                } else {
                    ui.showOfflineMessage();
                }
            });
            
            
            $bizAddList.append($bizAddress.append($bizlink));
            allLists.push($bizAddList);
        }
        
        
        $.each(allLists, function(e, f) {
            $("#contact-detail-container").append($(f));
            // jqm mobile stuff
            // we can only trigger the create on the list if
            // it was not inited by the page before.
            // This usally happens on the first time the contact detail page
            // is visited. After this we need to trigger the listview() by
            // ourselfs
            if (wasInited) {
                $(f).listview();
            }
        });
        
        // callback
        if (typeof(cb) === 'function') {
            cb();
        }
        
    };
    /*
     * draw a detail view of a distribution list
     */
    var drawDistributionList = function(data, options) {
        var defaults = { callback: $.noop };
        $.extend(defaults, options);
        
        // draw listname
        $("#contact-main-detail-container")
            .append($completeName.html($('<a>').attr({
                'data-inline': 'true',
                'href': '#'
            })
            .text(data.display_name)
            .bind('click', function() {
                $(events).trigger("contact_selected", {
                    id: data.id,
                    text: data.display_name,
                    meta: { contactSelect: "to" },
                    fullDataSet: mox.contacts.getContactByID(data.id)
                });
            })
            .button()));
        // draw all list entries
        $list = createList();
       
        var fullstring = "";
        $.each(data.distribution_list, function(i, elem) {
            fullstring = elem.mail;
            if (elem.display_name && elem.mail) {
                fullstring = elem.display_name + " <" + elem.mail +">";
            }
            $list.append(
                $("<li>").append(
                    $('<a href="#">')
                        .addClass("contact-detail-list-color contact-detail-address")
                        .text(fullstring)
                        .bind("tap", function(e) {
                            e.preventDefault();
                            if (online) {
                                mox.mail.newMail.addTo(elem.mail);
                                mox.mail.addMailRecipient("to", elem.mail, elem.mail);
                                $.mobile.changePage("#newmail", {transition: transitions.slideup, changeHash: false});
                                mox.mail.newMail.setLastPage("#contactdetail");
                            } else {
                                ui.showOfflineMessage();
                            }
                        })
                    )
                );
        });
        
      
        $("#contact-detail-container").append($list);
        // jqm mobile stuff
        // we can only trigger the create on the list if
        // it was not inited by the page before.
        // This usally happens on the first time the contact detail page
        // is visited. After this we need to trigger the listview() by
        // ourselfs
        if (wasInited) {
            $($list).listview();
        }
        
        // callback
        defaults.callback();
    };
    
    var contactview = {
        drawContact: function(id, cb) {
            drawContact(id, cb);
        },
        refreshContact: function(cb) {
            if (actualContactShowing !== '') {
                drawContact(actualContactShowing, cb);
            } else {
                if (typeof(cb) === "function") {
                    cb();
                }
            }
        },
        setWasInited: function(init) {
            wasInited = init;
        },
        getWasInited: function() {
            return wasInited;
        },
        setMailSelectMode: function(state) {
            
        },
        getMailSelectMode: function() {
            return mailSelectMode; 
        },
        getCurrentContactId: function() {
            return actualContactShowing;
        },
        drawMailChoose: drawMailChoose
    };
    return contactview;
};

var contactviewer = new ContactViewer();
/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */

/**
 * Class ContactEditor
 * @returns
 */

var ContactEditor = function() {
    var init = false;
    var cc = {};

    var clearPage = function() {
        $("#contact-edit-image-container").empty().removeClass("dummy realimg");
        $("#contact-edit-container, #contact-main-edit-container, #contact-edit-foldercontainer").empty();
    };

    var setContactImage = function(url) {
        // hijacking this function to hide the contact image
        // and get the space for the rest
        /*if (url === "default") {
            $("#contact-edit-image-container").addClass("dummy");
        } else {
            $('<img>')
                .attr("src", HOSTONLY + url)
                .addClass("contact-detail-image-container realimg")
                .appendTo("#contact-edit-image-container");
        }*/
    };

    var createList = function() {
        return $("<ul>")
            .attr({
                "data-role" : "listview",
                "data-inset" : "true"
            })
            .addClass('custom-list input-list');
    };

    var createListInputElement = function(label, name, value, showLabel, type) {
        var $listElement = $('<li>')
            .append( $('<table>')
                .addClass('custom-list-table')
                .append($('<tr>')
                    .append(showLabel ? createLabel(label, name) : '')
                    .append($('<td>').append(createInputElement(showLabel ? '' : label, name, value, type)))
                )
            );

        if (showLabel && !value) {
            $listElement
                .attr('id', 'hidden-' + name)
                .addClass('ui-screen-hidden');
        }
        return $listElement;
    };

    var createListAdressElement = function(label, contact) {
        var prefix = (label == 'Private address' ? 'home' : 'business');
        var street = contact['street_' + prefix];
        var zip = contact['postal_code_' + prefix];
        var city = contact['city_' + prefix];
        var $wrapper = $('<td>')
            .append(createInputElement(_i18n('Street').toString(), 'street_' + prefix, street))
            .append(createInputElement(_i18n('Zip').toString(), 'postal_code_' + prefix, zip))
            .append(createInputElement(_i18n('City').toString(), 'city_' + prefix, city));
        var $listAdressElement = $('<li>')
            .append( $('<table>')
                .addClass('custom-list-table')
                .append($('<tr>')
                    .append(createLabel(label, name))
                    .append($wrapper)
                )
            );


        if ( !street && !zip && !city ) {
            $listAdressElement
                .attr('id', 'hidden-adress-' + prefix)
                .addClass('ui-screen-hidden');
        }
        return $listAdressElement;
    };

    var createLabel = function(label, name) {
        var $label = $('<label>')
            .attr({ "for" : name !== null ? name : '' })
            .text(label)
        return $('<td>')
            .addClass('custom-list-label nobackground')
            .append($label)
            // function to expand label fields on tap
            .on('tap', function (e) {
                    $label = $(this).children();
                    if (!$label.attr('data-originalwidth')) {
                        $label.attr('data-originalwidth', $label.css('width'));
                    }
                    var originalWidth = $label.attr('data-originalwidth');
                    var expandWidth = parseInt(originalWidth) * 1.6; // expand 60 percent
                    expandWidth = Math.ceil(expandWidth) +'px';
                    if ($label.css('width') !== expandWidth ) {
                        $label.css('width', expandWidth);
                    } else {
                        $label.css('width', originalWidth);
                    }
                }
            );;
    };

    var createInputElement = function(placeholder, name, value, type) {
        return $('<input/>')
            .attr({
                "type" : !type ? 'text' : type,
                "name" : name,
                "placeholder" : placeholder,
                "id" : "edit_" + name
            })
            .addClass('custom-input invisible')
            .val(value);
    };

    var editContact = function(id, cb) {

        var createMode = !id;
        // clean view
        clearPage();

        if (createMode) {
            // create folder select for new contacts
            var $folderSelect = $('<select>')
                .attr('name', 'folder_id');
            $('#contact-edit-foldercontainer')
                .append($folderSelect);
            // build options
            $.each(mox.contacts.contactFolders, function(id, folder) {
                // check write permisson
                // folder.data[7] : rights
                var writable = util.getPermission(folder.data[7], 0).bit >= 2;

                // build option tag
                // folder.data[2] : Name
                if (writable) {
                    var $option = $('<option>')
                        .text(folder.data[2])
                        //.prop('selected', folder.data[8])
                        .attr('value', id);

                    if (id === localUserConfig.defaultContactStoreFolder) {
                        $option.prop('selected', true);
                    }
                    $folderSelect
                        .append($option);
                }
            });

            cc = {};
            $('#contactsEditHeader')
                .text(_i18n('New Contact').toString());
        } else {
            // get current contact object
            cc = mox.contacts.getContactByID(id);
            $('#contactsEditHeader')
                .text(_i18n('Edit Contact').toString());
        }

        // contact image
        if (cc.image1_url) {
            setContactImage(cc.image1_url);
        } else {
            setContactImage("default");
        }

        // main contact information
        $("#contact-main-edit-container")
            .append(createList()
                .append(createListInputElement(_i18n('First name').toString(), 'first_name', cc.first_name, false))
                .append(createListInputElement(_i18n('Last name').toString(), 'last_name', cc.last_name, false))
                .append(createListInputElement(_i18n('Displayname').toString(), 'display_name', cc.display_name, false))
                .append(createListInputElement(_i18n('Company').toString(), 'company', cc.company, false))
            );

        // autocomplete displayname
        var ln = $('#edit_last_name').val();
        var fn = $('#edit_first_name').val();
        var autofillmatch = (ln + (fn && ln ? ", " : "") + fn) == (cc.display_name ? cc.display_name : "");

        $('#edit_last_name, #edit_first_name').bind('keyup', function(e) {
            var $dn = $('#edit_display_name');
            var ln = $('#edit_last_name').val();
            var fn = $('#edit_first_name').val();
            if ($dn.val() === "" || autofillmatch) {
                $dn.val(ln + (fn && ln ? ", " : "") + fn);
            }
        });

        $('#edit_display_name').bind('keyup', function(e) {
            if (e.which >= 32) {
                autofillmatch = false;
            }
        });

        // fill input fields
        var $container = $('#contact-edit-container');
        $container
            // all phonenumbers are on the top
            .append(createList()
                .append(createListInputElement(_i18n('Mobile').toString(), 'cellular_telephone1', cc.cellular_telephone1, true, 'tel'))
                .append(createListInputElement(_i18n('Private phone').toString(), 'telephone_home1', cc.telephone_home1, true, 'tel'))
                .append(createListInputElement(_i18n('Mobile 2').toString(), 'cellular_telephone2', cc.cellular_telephone2, true, 'tel'))
                .append(createListInputElement(_i18n('Business phone').toString(), 'telephone_business1', cc.telephone_business1, true, 'tel'))
            )
            // display emails next
            .append(createList()
                .append(createListInputElement(_i18n('E-Mail').toString(), 'email1', cc.email1, true, 'email'))
                .append(createListInputElement(_i18n('E-Mail 2').toString(), 'email2', cc.email2, true, 'email'))
                .append(createListInputElement(_i18n('E-Mail 3').toString(), 'email3', cc.email3, true, 'email'))
            )
            // addresses
            .append(createList()
                .append(createListAdressElement('Private address', cc))
                .append(createListAdressElement('Business address', cc))
            );

        // select for hidden elements
        $sel = $('<select>')
            .append($('<option>').attr('removeable', false).text(_i18n('Add new field').toString()))
            .change(function(e) {

                if (util.isIOS6() === true) {
                    return;
                }
                $this = $(this);
                $this.selectmenu('close');
                // show selected field
                $('#' + $this.val())
                    .hide()
                    .removeClass('ui-screen-hidden')
                    .slideDown();
                // remove from selection
                if ($(':selected', $this).attr('removeable') !== 'false') {
                    $(':selected', $this).remove();
                }

                // disable if empty
                if ($('option', $this).length < 2) {
                    $this.selectmenu('disable');
                }
                $('#contactedit-content ul')
                    .listview('refresh');
                $this
                    .selectmenu('refresh', true);
                $this.blur();

            }).blur(function () {

                if (util.isIOS6() === false ) {
                    return;
                }
                $this = $(this);
                $this.selectmenu('close');
                // show selected field
                $('#' + $this.val())
                    .hide()
                    .removeClass('ui-screen-hidden')
                    .slideDown();
                // remove from selection
                if ($(':selected', $this).attr('removeable') !== 'false') {
                    $(':selected', $this).remove();
                }
                // disable if empty
                if ($('option', $this).length < 2) {
                    $this.selectmenu('disable');
                }
                $('#contactedit-content ul')
                    .listview('refresh');
                $this
                    .selectmenu('refresh', true);

            });
            $('#contact-edit-container li.ui-screen-hidden').each(function(i,e) {
                $sel.append($('<option>').text($(e).find('label').text()).attr('value', $(e).attr('id')));
            });
        $container
            .append($sel);


        if (!createMode) {
            // check delete rights
            var permisson = util.getPermission(mox.contacts.contactFolders[cD.folder_id].data[7], 21).bit;
            if(permisson >= 2 || (permisson == 1 && cc.created_by == userID)) {
                var $delButton = $("<a>")
                .attr({
                    href: "#",
                    "data-role": "button",
                    "data-theme": "a",
                    "class": "custom-standard-button custom-button-popup delete large",
                    "id": "deletecontactbutton"
                })
                .text(_i18n("Delete").toString())
                .bind("tap", function(e) {
                    e.preventDefault();
                    var buttons = [{
                        text: _i18n("Delete Contact").toString(),
                        delbutton: true,
                        action: function() {
                            mox.contacts.deleteContact(cc, function() {
                                mox.contacts.checkUpdates(function() {
                                    $.mobile.changePage("#contacts", { transition : transitions.slidedown });
                                });
                            });
                        }
                    }, {
                        text: _i18n("Cancel").toString(),
                        secondary: true,
                        action: $.noop
                    }];

                    // show overlay
                    ui.bottomSelectBox({
                        buttons: buttons,
                        method: "click" // tap can effect ghostcklicks
                    });
                });
                $container
                    .append($delButton);
            }
        }

        // jqm mobile stuff
        // we can only trigger the create on the list if
        // it was not inited by the page before.
        // This usally happens on the first time the contact detail page
        // is visited. After this we need to trigger the listview() by
        // ourselfs
        if (init) {
            $('#contactedit-content ul').listview();
            $('#contactedit-content select').selectmenu();
            $('#contactedit-content a').button();
        } else {
            init = true;
        }

        // focus first inputfield
        setTimeout(function() {
            $('#contactedit-content input')
                .textinput()
                .first()
                .focus();
        }, 0);

        // callback
        if (typeof(cb) === 'function') {
            cb();
        }

    };

    var getFormData = function() {
        $('#contact-edit-form input')
            .val(function(i, val) {
                return (val === $(this).attr('placeholder')) ? '' : val;
            });
        var formData = $('#contact-edit-form').serializeArray();
        var diff = {}, folderID;
        $.each(formData, function(i, e) {
            if (e.name === 'folder_id') {
                folderID = e.value;
                return true; // skip
            }
            e.value = e.value === "" ? null : e.value;
            if (cc[e.name] != e.value) {
                diff[e.name] = e.value;
            }
        });
        if (!_.isEmpty(diff)) {
            diff.folder_id = folderID;
        }
        return diff;
    };

    var contacteditor = {
        editContact: function(id, cb) {
            editContact(id, cb);
        },
        newContact: function(cb) {
            editContact(null, cb);
        },
        getFormData: function() {
            return getFormData();
        },
        getCurrentContact: function() {
            return cc;
        }
    };
    return contacteditor;
};

var contacteditor = new ContactEditor();
/**
 * All content on this website (including text, images, source code and any
 * other original works), unless otherwise noted, is licensed under a Creative
 * Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2004-2010 Open-Xchange, Inc. Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

// all contactlistviews
var globalContactListViews = {};

// init default values
mox.contacts = {
    allEmailAddresses : [],
    autocompleteList : [],
    contactFolders : {},
    completeContactList : {
        order: [],
        timestamp: 0
    },
    fields : {
          "1" : "id",
          "2" : "created_by",
          "6" : "last_modified", // last_modified_utc
         "20" : "folder_id",
        "500" : "display_name",
        "501" : "first_name",
        "502" : "last_name",
        "506" : "street_home",
        "507" : "postal_code_home",
        "508" : "city_home",
        "523" : "street_business",
        "524" : "internal_userid",
        "525" : "postal_code_business",
        "526" : "city_business",
        "542" : "telephone_business1",
        "548" : "telephone_home1",
        "551" : "cellular_telephone1",
        "552" : "cellular_telephone2",
        "555" : "email1",
        "556" : "email2",
        "557" : "email3",
        "558" : "url",
        "565" : "instant_messenger1",
        "569" : "company",
        //"570" : "image1",
        "592" : "distribution_list",
        "606" : "image1_url"
    },
    columns : "1,500,501,502,555,506,507,508,548," +
        "552,565,569,523,525,526,542,551,566,511,558,556,557,606,592,20,6,2,524"
};

/**
 * add an email address to the global list of all emails
 * This list will be used by autocomplete
 */
mox.contacts.addToGlobalEmailList = function(data, dn) {
    var mailIDs = [4,20,21];
    for (var i = 0; i < mailIDs.length; i++) {
        var email = data[mailIDs[i]];
        if ( ( email !== null ) && ($.inArray(email, this.allEmailAddresses) === -1)) {
            this.allEmailAddresses.push(email);
            this.autocompleteList.push({
                mail : email,
                search : $.trim(data[1] + ' ' + data[2] + ' ' + data[3] + ' ' + data[11] + ' ' + email),
                display: dn
            });
        }
    }
};

/**
 * resolve a field to cleartext or reverse
 * @param field String, either a number or a text
 * @example "509" <--> "state_home"
 */
mox.contacts.resolveField = function(field) {
  if (field.match(/[0-9]/)) {
      return this.fields[field];
  } else {
      $.each(this.fields, function(i, e) {
          _.debug('contacts.resolveField: unknown field');
          if (e === field) {
              return i;
          }
      });
  }
};
//
///**
// *
// */
//mox.contacts.removeLocalContactFolder = function(folder) {
//    var list = localUserConfig.storage.contactStorageList,
//        id = list.find(folder)[0],
//        entry = $.grep(localUserConfig.folderTree.contactFolders, function(i, e) {
//            return (i[0] == folder);
//        });
//    entry[0][17].fetched = false;
//
//    localUserConfig.storage.contactStorageList.splice(id, 1);
//
//    // both lists are equal
//    localUserConfig.subscribedFolders.contacts = localUserConfig.storage.contactStorageList;
//
//    $("#contactFolder" + folder).remove();
//    $("#href_contactFolder" + folder).parent().remove();
//    if (list.length === 0) {
//        // gui.messageSelectContactFolder();
//    }
//};

/**
 * get contacts count for each folder
 *
 * @param {Object}
 *            folders
 * @param {Object}
 *            callback
 */
mox.contacts.getContactCount = function(folders, cb) {

    var url = HOST + "/multiple?continue=true&session=" + session,
        requestBody = [];
    for (var i = 0; i < folders.length; i++) {
        requestBody.push({
            "module" : "contacts",
            "action" : "all",
            "columns" : "1",
            "folder" : folders[i][0]
        });
    }
    var successHandler = function(e) {
        if (e.error) {
            mox.error.handleError(e);
        } else {
            localUserConfig.folderTree.contactsCount = {};
            for (var i = 0; i < e.length; i++) {
                if (e[i].data) {
                    localUserConfig.folderTree.contactsCount[folders[i][0]] = e[i].data.length;
                } else {
                    // possible error
                    localUserConfig.folderTree.contactsCount[folders[i][0]] = 0;
                    mox.error.newError('[CONTACTS] Could not read contact count for folder ' + folders[i][0])
                }
            }

            if (typeof (cb) === "function") {
                cb();
            }
        }
    };
    if (requestBody.length > 0) {
        $.ajax({
            url : url,
            success : successHandler,
            error : errorHandler,
            data : JSON.stringify(requestBody),
            dataType : "json",
            type : "put",
            processData : false
        });
    }
};

/**
 * writeContactList
 *
 * write all contacts of a folder to a list using
 * ContactListView
 */
mox.contacts.writeContactList = function(ob) {
    _.debug('contacts.writeContactList', ob);
    // folder id
    var id = ob.data[0],
        contacts = ob.list.data;
    // create new ContactListView object
    if (_.isUndefined(globalContactListViews[id])) {
        _.debug('contacts.create new ContactList', id);
        // create a container
        var conID = "contactlistcontainer_" + id;
        ui.page.addListContainer(conID, "#contacts-content");
        globalContactListViews[id] = new ContactListView(conID, id, contacts);
    } else {
        _.debug('contacts.update ContactList', id);
        // update
        globalContactListViews[id].update(contacts);
    }
};

/**
 * get all subscribed folders
 *
 * @param folders Array
 *            array of folder ids
 * @param cb
 *            to execute after ajax has finished
 */
mox.contacts.getAllContactsSorted = function(folders, cb, orderOnly) {
    _.debug("contacts.getAllContactsSorted", folders, cb, orderOnly);
    var sortfield = "607";
    /*
    -- these fields will be fetched --
    id
    folder_id
    display_name
    first_name
    last_name
    email1
    street_home
    postal_code_home
    city_home
    telephone_home1
    cellular_telephone2
    instant_messenger1
    company
    street_business
    postal_code_business
    city_business
    telephone_business1
    cellular_telephone1
    instant_messenger2
    birthday
    url
    email2
    email3
    image1_url
    last_modified
    created_by
    */

    if (folders.length === 0) {
        // no folders selected
        // create empty list to prevent access errors
        // create a container
        ui.page.addListContainer("contactlistcontainer_all", "#contacts-content");
        // create new ContactListView object
        globalContactListViews.all = new ContactListView("contactlistcontainer_all",
                {id: "all", name: "contacts", folderdata: "Globalcontacts"});
        globalContactListViews.all.showEmptyMessage();

    } else if (online) {
        var url = HOST + "/contacts?action=search&session=" + session +
            "&sort=" + sortfield + "&order=asc&columns=" + (orderOnly ? '1' : this.columns);
        var requestBody = {
            folder : folders,
            pattern: "*" // search for everything
            };
        var successHandler = function(data, folders) {
            _.debug('contacts.getAllContactsSorted onSuccsess', data);
            if (data.error) {
                mox.error.handleError(data);
            } else {
                if (!orderOnly) {
                    mox.contacts.completeContactList = {};
                }
                var oldList = mox.contacts.completeContactList.order;
                mox.contacts.completeContactList.order = [];
                for (var i = 0; i < data.data.length; i++) {
                    var el = data.data[i];
                    if (!orderOnly) {
                        mox.contacts.completeContactList[el[0]] = el;
                    }
                    mox.contacts.completeContactList.order.push(el[0]);
                }
                var delList = _.difference(oldList, mox.contacts.completeContactList.order);
                mox.contacts.completeContactList.timestamp = data.timestamp;
                mox.contacts.completeContactList.folders = folders;

                // update local storage
                try{
                    if(storage.getMode() !== 0) {
                        _.debug('contacts.save contacts to local storage', mox.contacts.completeContactList, data);
                        storage.setItem("contacts", mox.contacts.completeContactList, true);
                    }
                } catch(e) {
                    mox.error.newError("[Storage] Error during save", e);
                }

                mox.contacts.writeContactList({
                    list : {
                        data : mox.contacts.completeContactList
                    },
                    data : [ "all", "contacts", "Globalcontacts" ]
                });

                if (typeof (cb) === "function") {
                    cb(mox.contacts.completeContactList, delList);
                }

                $(events).trigger("contacts_ready",{ contactlist: mox.contacts.completeContactList });
            }
        };

        $.ajax({
            url : url,
            success : function(data) {
                successHandler(data, folders);
            },
            error : errorHandler,
            data : JSON.stringify(requestBody),
            dataType : "json",
            type : "put"
        });
    } else {
        // offline mode
    }
};

mox.contacts.initContacts = function() {
    // check restore
    _.debug('contacts.initContacts', this.completeContactList);
    if (this.completeContactList.timestamp === 0) {
        if (!datastore.restoreContacts()) {
            _.debug('contacts.restore failed, refresh all data');
            this.getAllContactsSorted(localUserConfig.subscribedFolders.contacts);
            return;
        } else {
            this.checkUpdates($.noop, true);
        }
    }
};

/**
 * checkUpdates
 * check for updates and write them to contacts data
 * @param cb    Function    callback
 * @param init  Boolean     is initial?
 */
mox.contacts.checkUpdates = function(cb, init) {
    var folder = localUserConfig.subscribedFolders.contacts;
    init = init || false;
    _.debug('contacts.checkUpdates', folder, cb, init);

    if (folder.length > 0) {
        // if empty, restore
        if (online) {
            var successHandler = function(updates, folder, init, cb) {
                _.debug('contacts.checkUpdates success', updates);
                if (updates.error) {
                    mox.error.handleError(updates);
                } else {
                    // last update TS
                    var maxTS = 0,
                        updateCount = 0,
                        folderDiff = _.difference(mox.contacts.completeContactList.folders, folder).length > 0;

                    // udpdate all contact data
                    for (var i = 0; i < updates.length; i++) {
                        var tmpFolder = updates[i];
                        maxTS = Math.max(maxTS, tmpFolder.timestamp);
                        if (tmpFolder.data && tmpFolder.data.length > 0) {
                            updateCount++;
                            for (var j = 0; j < tmpFolder.data.length; j++) {
                                // update local contacts
                                var upCon = tmpFolder.data[j];
                                var conID = upCon[0];
                                mox.contacts.completeContactList[conID] = upCon;
                            }
                        }
                    }

                    if (init || folderDiff) {
                        if (updateCount > 0 || folderDiff) {
                            _.debug('contacts.found some updates on init, refresh all data', folder, init, updateCount, folderDiff);
                            mox.contacts.getAllContactsSorted(folder, cb);
                        }
                        // need to trigger contact list ready event
                        $(events).trigger('contacts_ready', { contactlist: mox.contacts.completeContactList });
                    } else {
                        _.debug('contacts.update', folder, init, updateCount);
                        // get new order and remove deleted contacts
                        var cleanCallback = function(data, del) {
                            for (var i = 0; i < del.length; i++) {
                                delete mox.contacts.completeContactList[del[i]];
                            }
                        };
                        mox.contacts.getAllContactsSorted(localUserConfig.subscribedFolders.contacts, cleanCallback, true);

                        // callback
                        if (typeof(cb) === 'function') {
                            cb(updates);
                        }
                    }
                }
            };

            var url = HOST + "/multiple?continue=true&session=" + session,
                requestBody = [];
            for (var i = 0; i < folder.length; i++) {
                requestBody.push({
                    "module" : "contacts",
                    "action" : "updates",
                    "folder" : folder[i],
                    "columns" : this.columns,
                    "timestamp" : this.completeContactList.timestamp,
                    "ignore" : "deleted"
                });
            }

            $.ajax({
                url : url,
                success : function(data) {
                    successHandler(data, folder, init, cb);
                },
                error : errorHandler,
                data : JSON.stringify(requestBody),
                dataType : "json",
                type : "put"
            });
        } else {
            // offline mode: do nothing
        }
    } else {
        globalContactListViews.all.showEmptyMessage();
    }
};

/**
 * getContactByID
 * gets a single contact from local cache by id
 * this assumes all contact IDs a unique even in
 * different folders
 * @param id String contactid
 */
mox.contacts.getContactByID = function(id) {
    var contact = this.completeContactList[id],
        columns = this.columns.split(","),
        obj = {};

    for (var i = 0; i < contact.length; i++) {
        obj[this.resolveField(columns[i])] = contact[i];
    }

    return obj;
};

/**
 * updateContact
 * updates contact attributes
 * @param cD    object   current contact data form local store
 * @param diff  object   contact data to be updated
 * @param cb    function callback on sucess
 */
mox.contacts.updateContact = function(contact, diff, cb) {
    _.debug('contacts.updateContact', contact, diff);
    if (online) {
        var url = HOST + "/contacts?action=update&session=" + session +
            "&folder=" + contact.folder_id + "&id=" + contact.id + "&timestamp=" + contact.last_modified;
        $.ajax({
            url : url,
            success : function(data) {
                if (data.error) {
                    mox.error.handleError(data.error);
                } else {
                    // udpdate all contact data
                    _.debug('contacts.updateContact Callback', data, cb);
                    if (typeof(cb) === 'function') {
                       cb(data, contact);
                    }
                }
            },
            error : errorHandler,
            data : JSON.stringify(diff),
            dataType : "json",
            type : "put"
        });
    } else {
        // offline mode
    }
};

/**
 * createContact
 * add a single contact to a given folder
 * @param contact   object   contact data
 * @param cb        function callback on sucess
 */
mox.contacts.createContact = function(contact, cb) {
    _.debug('contacts.createContact', contact);

    if (online && contact.folder_id) {
        var url = HOST + "/contacts?action=new&session=" + session;
        $.ajax({
            url : url,
            success : function(data) {
                if (data.error) {
                    _.debug('contacts.createContact error', data);
                    // special error handling here for contacts create
                    if (data.code === 'CON-0100' && data.categories === 'USER_INPUT') {
                        ui.showAlertBox(data.error,
                            { buttons: [
                                {
                                    text: _i18n("Ok").toString(),
                                    action: $.noop,
                                    primary: true
                                }
                                ]
                            });
                    } else {
                        mox.error.handleError(data);
                    }
                } else {
                    // udpdate all contact data
                    _.debug('contacts.createContact Callback', data, cb);
                    if (typeof(cb) === 'function') {
                        cb(data, contact);
                    }
                }
            },
            error : errorHandler,
            data : JSON.stringify(contact),
            dataType : "json",
            type : "put"
        });
    } else {
        // offline mode
    }
};

/**
 * deleteContact
 * delete a single contact
 * @param contact   object   contact data
 * @param cb        function callback on sucess
 */
mox.contacts.deleteContact = function(contact, cb) {
    _.debug('contacts.deleteContact', contact);

    if (online && contact.folder_id && contact.id && contact.last_modified) {
        var requestBody = {
            id : contact.id,
            folder : contact.folder_id
        };
        var url = HOST + "/contacts?action=delete&session=" + session + "&timestamp=" + contact.last_modified;
        $.ajax({
            url : url,
            success : function(data) {
                // udpdate all contact data
                _.debug('contacts.deleteContact Callback', data, cb);
                if (typeof(cb) === 'function') {
                   cb(data, contact);
                }
            },
            error : errorHandler,
            data : JSON.stringify(requestBody),
            dataType : "json",
            type : "put"
        });
    } else {
        // offline mode
    }
};

/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

/*global globalListViews, unreadMails */

var ui = {
    menu: { },
    page: { },
    mail: { },
    contacts: { }
};

(function() {
    /** MODAL SCREEN **/
    var modalState = false;

    var setModal = function(state, transparent) {
        transparent = transparent || false;
        if (state) {
            if (!modalState) {
                modalState = true;
                var $div = $("<div>")
                    .attr("id", "blockerdiv")
                    .bind("touchmove", function(e) {
                        // prevent scrolling/moving on the modal dialog
                        e.preventDefault();
                    })
                    .addClass("blocker" + (transparent ? '' : ' blocker-decoration'))
                    .css("top", (window.pageYOffset) + 'px');
                $("body").append($div);
            }
        } else {
            modalState = false;
            $("#blockerdiv").remove();
        }
    };

    var blockScreen = function(state) {
        setModal(state, true);
    };

    // alertbox state
    var alertBoxShowing = false;

    /**
     * shows an alertbox on top of screen with one or more buttons
     * @param text: The message text
     * @param options: {buttons: [{text: String, action: function}, {...}]}
     */
    var alertBox = function(text, options) {
        if (alertBoxShowing) {
            return false;
        }

        // fix for bug 22172
        // force redraw of footer bar to apply new class
        var $footer = $(".ui-footer-fixed, .ui-header-fixed", $.mobile.activePage).css("position", "absolute");

        // hide keyboard
        $('input:focus').blur();
        document.activeElement.blur();

        setModal(true);
        alertBoxShowing = true;
        var $div = $("<div>").attr("id", "alertBox").addClass("infoBox"),
            $innerdiv = $("<div>").text(text).append("<br>");
        if (options.list) {
            var list = '';
            for ( var i = 0; i < options.list.length; i++ ) {
                list += '<li>' + options.list[i] + '</li>';
            }
            $innerdiv.append('<ul class="list">' + list + '</ul>');
        }

        $.each(options.buttons, function(i, elem) {
            var $button = $("<a>").attr({
                href: "#",
                "data-role": "button",
                "data-inline": true,
                "data-theme": "a",
                "class": "custom-standard-button ui-btn ui-btn-inline ui-btn-corner-all ui-shadow ui-btn-up-c"
            });

            if (elem.primary) {
                $button.addClass("custom-button-popup");
            } else if (elem.delbutton) {
                $button.addClass("custom-button-popup delete");
            } else {
                $button.addClass("custom-button-popup secondary");
            }

            var btnSpan1 = $("<span>").attr({
                "class": "ui-btn-inner ui-btn-corner-all",
                "aria-hidden":true,
                "style": "padding-left: 10px; padding-right: 10px"
            });
            var btnSpan2 = $("<span>").attr({
                "class": "ui-btn-text"

            });
            $button
                .append(btnSpan1.append(btnSpan2.text(elem.text)))
                .bind("click", {action: elem.action}, function(e) { // tap can effect ghostcklicks
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.data.action();
                    ui.removeAlertBox();
                    ui.setModal(false);
                    // fix for bug 22172
                    // force redraw of footer bar to apply new class
                    $footer.css("position","fixed");
                });
            $innerdiv.append($button).addClass("infoBox-content");

        });

        $div.append($innerdiv);

        // repositioning
        $div.css("top", (window.pageYOffset + 100) + 'px');


        $("body").append($div.on('touchmove', function(e) {
            e.preventDefault(); // prevent touchmove on alert box
        }));

        var $buttons = $(".infoBox-content > a");
        if ($buttons.length > 1) {
            var maxButtonWidth = 0;
            $.each($buttons, function() {
                var c = $(this).width();
                if (maxButtonWidth < c) {
                    maxButtonWidth = c;
                }
            });

            $.each($buttons, function(){
                $(this).css("width", "44%");
            });
        } else {
            $($buttons).css("width","94%");
        }
    };

    /**
     * function removeAlertBox
     * remove a showing alertbox
     */
    var removeAlertBox = function() {
        $("#alertBox").remove();
        alertBoxShowing = false;
    };

    /**
     * function rePositionSelectBox
     * move the selectbox to a visible position
     * on screen
     */
    var rePositionSelectBox = function(availheight) {
        var $box = $("#bottomselectbox");
        var scrolltop = $("body").scrollTop();
        var boxpos = scrolltop + availheight - 180;
        $box.css("top", boxpos +"px");
    };

    /**
     * on rotation change we need to reposition our
     * modal overlays
     */
    var redrawOnRotate = function () {
        // need a timeout here since android and ios do trigger the event
        // not at the same moment. One does it before it changes the layout, one after it has changed
        setTimeout(function() {
            var $selectBox = $('#bottomselectbox'),
                $blockerDiv = $('#blockerdiv'),
                availheight = window.innerHeight,
                scrolltop = $("body").scrollTop();
                boxpos = scrolltop + availheight - (parseInt($selectBox.data('buttons') * 60));
            $selectBox.css('top', boxpos + 'px');
            $blockerDiv.css('top', (window.pageYOffset) + 'px' );
        }, 350);
    };

    /**
     * bottomSelectBox
     * adds a selectbox with buttons on the page bottom
     * @param options object
     * contains array "buttons" with button objects
     * contains "method" which can be "tap" or "touchstart"
     */
    var bottomSelectBox = function(options) {
        _.debug("bottom select", options);
        setModal(true);

        // hide keyboard
        $('input:focus').blur();
        document.activeElement.blur();

        // fix for bug 22172
        // force redraw of footer bar to apply new class
        var $footer = $(".ui-footer-fixed, .ui-header-fixed", $.mobile.activePage).css("position", "absolute");
        var $selectbox = $("<div>").attr("id","bottomselectbox");
        $selectbox.addClass("bottom-selectbox");

        // calculate the position of the selectbox
        var availheight = window.innerHeight;
        var scrolltop = $("body").scrollTop();
        var boxpos = scrolltop + availheight - (options.buttons.length * 60); // be aware of amount of buttons

        $.each(options.buttons, function(i, elem) {

            var $button = $("<a>").attr({
                    href: "#",
                    "data-role": "button",
                    "data-inline": true,
                    "data-theme": "a",
                    "class": "custom-standard-button bottombutton custom-button-popup"
                })
                .text(elem.text)
                .bind(options.method, {action: elem.action}, function(e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.data.action();
                    ui.removeBottomSelectBox();
                    ui.setModal(false);
                    // fix for bug 22172
                    // force redraw of footer bar to apply new class
                    $footer.css("position", "fixed");
                }, true)
                .button();

            if (elem.primary) {
                //
            } else if (elem.delbutton) {
                $button.addClass("delete");
            } else {
                $button.addClass("secondary");
            }
            $selectbox.append($button);
        });

        // store button count for later access
        $selectbox.data('buttons', options.buttons.length);

        // set pos and prevent scrolling
        $selectbox.css("top", boxpos + "px").on('touchmove', function(e) {
            e.preventDefault();
        });


        //$(window).on('orientationchange', redrawOnRotate);

        //append box to body
        $("body").append($selectbox);

    };
    /**
     * remove the bottom select box
     */
    var removeBottomSelectBox = function() {
        $(window).off('orientationchange', redrawOnRotate)
        $(".bottom-selectbox").remove();
    };
    /**
     * display standard warning for offline mode
     */
    var showOfflineMessage = function() {
        ui.showAlertBox(_i18n("This function requires a network connection.").toString(), {
            buttons: [{
                text: _i18n("Ok").toString(),
                action: function() {
                    /* pageloading */
                }
            }]
         });
    };
    /**
     * remove offline message
     */
    var hideOfflineMessage = function() {
        ui.removeAlertBox();
    };
    /**
     * generate html block representing a clearbutton for input elements
     */
    var getClearButton = function() {
        return $('<a href="#" class="inputresetbutton ui-input-clear ui-btn ui-btn-up-c ui-shadow ui-btn-corner-all ui-fullsize ui-btn-icon-notext">'
                + '<span class="ui-btn-inner ui-btn-corner-all">'
                + '<span class="ui-icon ui-icon-delete ui-icon-shadow">&nbsp;</span>'
            + '</span>'
        + '</a>');
    };

    // public
    ui.setModal = setModal;
    ui.blockScreen = blockScreen;
    ui.showAlertBox = alertBox;
    ui.removeAlertBox = removeAlertBox;
    ui.bottomSelectBox = bottomSelectBox;
    ui.redrawOnRotate = redrawOnRotate;
    ui.removeBottomSelectBox = removeBottomSelectBox;
    ui.showOfflineMessage = showOfflineMessage;
    ui.hideOfflineMessage = hideOfflineMessage;
    ui.getClearButton = getClearButton;

/*******************************************/

    /**
     * removes delete and move button from footer
     */
    var disableContextButtons = function() {
        $("#mailDeleteButton, #mailMoveButton").remove();
    };

    /**
     * adds delete and move button to footer in edit mode
     */
    var addContextButtons = function(internalid) {
        var folder = mox.mail.folderIDMap[internalid];

        var $deleteButton = $("<a>").attr({
            "id": "mailDeleteButton",
            "data-role": "button",
            "href": "#",
            "data-icon": "delete-email"
        }).text(_i18n("Delete").toString());

        var $moveButton = $("<a>").attr({
            "id": "mailMoveButton",
            "data-role": "button",
            "href": "#",
            "data-icon": "move-email"
        }).text(_i18n("Move").toString());


        var $footer =  $("#mf_footer_" + internalid);
        $footer.append($deleteButton).append($moveButton);

        // init buttons
        $deleteButton
            .button()
            .addClass("custom-footer-button-left custom-delete-button ui-disabled");
        $moveButton
            .button()
            .addClass("custom-footer-button-right custom-standard-button ui-disabled");

        $($("#mf_footer_" + internalid).find(".ui-btn-text")[1]).css("padding-left","4px");

        $deleteButton.bind("tap", {folder: folder}, function(e) {
            e.preventDefault();
            var trashid = localUserConfig.folderTree.standardMailFolders['4_trash'].id;
            var folder = e.data.folder.folderid;
            var list = globalMailListViews[folder];
            var selectedMails = list.getSelected();
            var deleteMails = [];

            $.each(selectedMails, function(i, elem) {
                deleteMails.push({id: elem, folder: folder});
            });

            var deleteAction = function() {
                /* pageloading */
                mox.mail.deleteMails(deleteMails, function() {
                    list.setSelectMode(false);
                    mox.mail.updateMailFolders([folder, trashid], function() {
                        /* pageloading */

                    });
                });
            };
            // test if we are in trash. if so, display warning
            if (folder === trashid) {
                ui.showAlertBox(_i18n("Permanently delete E-Mails?").toString(),
                        {
                            buttons: [{
                                text: _i18n("Cancel").toString(),
                                action: $.noop

                            }, {
                                text: _i18n("Delete").toString(),
                                action: deleteAction,
                                delbutton: true
                            }]
                        });
            } else {
                deleteAction();
            }

            return false;
        });

        $(events).unbind("folder_selected");

        $moveButton.bind("tap", {folder: folder}, function(e) {
            e.preventDefault();

            mox.mail.showMoveStatusMessage(
                    _i18n("Please select a target folder.").toString(), { });

            $.mobile.changePage("#mailmove", {transition: transitions.slide});
            var srcfolder = e.data.folder.folderid;
            var list = globalMailListViews[srcfolder];
            var selectedMails = list.getSelected();
            var mails = [];
            $.each(selectedMails, function(i, elem) {
                mails.push({
                    id: elem,
                    destfolder: "",
                    srcfolder: srcfolder
                });
            });
            var srcfoldername = mox.mail.getFolderFromMap(folder);
            srcfoldername = srcfoldername.folder;

            // will be bound to the event
            var folder_select_function = function(e, obj) {
                var destfolder = mox.mail.folderIDMap[obj.folder].folderid;
                if (srcfolder === destfolder) {

                    list.setSelectMode(false);
                    ui.page.goBack();
                } else {
                    list.setSelectMode(false);
                    // inject chosen folderid
                    $.each(mails, function(i, elem) {
                        elem.destfolder = destfolder;
                    });

                    // move mails and update folders
                    mox.mail.moveMail(mails, function(e) {
                        mox.mail.updateMailFolders([destfolder, srcfolder], function() {
                            mox.mail.showMoveStatusMessage(_i18n("Your E-Mails have been moved.").toString(),
                               {
                                time: 1500, // how long will the message be displayed
                                callback: function() {
                                    ui.page.goBack();
                                }
                            });
                        });
                    }, function(e) {

                        mox.error.handleError(e, function() {
                            ui.page.goBack();
                        });
                    });
                }
            };
            $(events).bind("folder_selected", folder_select_function);

        });

    };

    var buttonState = true;
    /**
     * enables/disables the context buttons "move" and "delete"
     * (gray out, do nothing on click)
     */
    var enableButton = function(state, internalid) {
        var btn = $("#mf_header_" + internalid).children()[0];
        var btn2 = $("#mf_header_" + internalid).children()[2];
        var btn3 = $("#mf_footer_" + internalid).children()[0];
        var btn4 =  $("#mf_footer_" + internalid).children()[2];

        if (state === false) {
            buttonState = false;
            $(btn).addClass("ui-disabled");

            $(btn2).children().text(_i18n("Cancel").toString());
            $(btn3).css("visibility", "hidden");
            $(btn4).css("visibility", "hidden");

            addContextButtons(internalid);

        } else {
            buttonState = true;
            disableContextButtons();
            $(btn).removeClass("ui-disabled");
            $(btn2).children().text(_i18n("Edit").toString());
            $(btn3).css("visibility", "visible");
            $(btn4).css("visibility", "visible");
        }
    };

    /** make buttons stateful **/
    $(events).bind("listview_select", function(e,f) {

        var $buttons = $("#mailDeleteButton, #mailMoveButton");

        if (f.selectedRows.length > 0 ) {
            $buttons.removeClass("ui-disabled");
        } else {
            if ( $buttons.hasClass("ui-disabled") == false ) {
                $buttons.addClass("ui-disabled");
            }
        }
    });


    /*
     * Modify the bottom toolbar and show context
     * sensitive buttons like "move" and "delete"
     * for the selected mails. If no mails are selected
     * disable the buttons.
     */
    var actionEditButton = function(data) {
        // disable back button in edit mode
        if (buttonState) {
            enableButton(false, data.internalid);
        } else {
            enableButton(true, data.internalid);
        }

    };

    /**
     * adds a new mailfolder page to the DOM
     * @param data, data object to deal with
     */
    var addMailfolderPage = function(data) {
        var folderid = data.folder;
        var id = data.id;
        var contentid = data.contentid;
        var headerid = data.headerid;
        var footerid = data.footerid;

        // page div
        var $page = $("<div>").attr({
            id: id,
            "data-role": "page",
            "data-title": mox.globalPageTitle || "OX Mobile"
        });

        // header for page
        var $header = $("<div>").attr({
            id: headerid,
            "data-role": "header",
            "data-position": "fixed",
            "data-tap-toggle": "false"
        });

        // back button on top left
        var $backButton = $("<a>").attr({
            "data-role": "button",
            "href": "#"
        }).text(_i18n("Back").toString()).addClass("custom-backbutton custom-standard-button");

        // dynamcially bind the back button to the page we came from
        $("#" + id).live("pageshow", function(a, b) {

            var page = $(b.prevPage).attr("id");

            // only bind pages which are "lower" in navigation
            if (page === "home" || page === "mailfolders" || page === "privatemailfolders") {
                $backButton.unbind().bind( "tap" , function(e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    $.mobile.changePage("#" + page, {transition: transitions.slide, reverse: true});
                });
            }
        });

        // the cancel/edit button on top right
        var $editButton = $("<a>").attr({
            "data-role": "button",
            "href": "#",
            "id": "cancelEditButton" + id
        }).text(_i18n("Edit").toString())
            .addClass("custom-standard-button")
            .bind( "tap", function(e) {
                if (online) {
                    e.preventDefault();
                    var list = globalMailListViews[folderid];

                    if (list.getMode() === false) {
                        list.setSelectMode(true);
                    } else {
                        list.setSelectMode(false);
                    }
                } else {
                    ui.showOfflineMessage();
                }
        });

        $header.append($backButton)
            .append($("<h1>"))
            .append($editButton)
            .addClass("header-bg");

        var $content = $("<div>").attr({
            id: contentid,
            "data-role": "content"
        });

        var $footer = $("<div>").attr({
            id: footerid,
            "data-role": "footer",
            "data-position": "fixed",
            "data-tap-toggle": "false"
        })
        .addClass("header-bg")
        .append($("<div>").addClass("footer-icon reload")
            .bind("click", function(e) {
                e.preventDefault();
                $(events).trigger("refresh");
            })
        )
        .append($("<div>").addClass("footer-icon").css("width", "59%"))
        .append($("<div>").addClass("footer-icon compose")
            .bind("click", function(e) {
                e.preventDefault();
                // TODO offline drafts
                mox.mail.newMail.setLastPage('#' + id);
                $(events).trigger("compose_mail");
                $.mobile.changePage("#newmail", {transition: transitions.slideup});
            })
        );

        // append everything to body
        $("body").append($page.append($header).append($content).append($footer));

        // jqm init for page
        $page.page();

        $page.live("pagecreate", function() {
            _.debug("pagecreate " + id);

            if (window.session === undefined) {
                $.mobile.changePage("#login");
            }
        });
    };

    /**
     * add a private mail folder to the list of folders
     * @param title
     * @param internalid
     */
    var addPrivateFolderToList = function(title, internalid) {
        var $li = $("<li>").attr("data-internal-id", internalid);

        var $link = $("<a>").attr({
            href: "#mf_" + internalid,
            "class": "font-color-1"
        });

        var $img = $("<div>").addClass("postbox-icon folder");

        var $span = $("<span>").text(title);
        $span.css("padding-left","40px");

        $img.addClass("folder-icon-position ui-li-thumb ui-li-icon");

        var $counter = $("<span>").addClass("custom-list-count");

        $link.append($img);
        $link.append($span);
        $link.append($counter);
        $li.append($link);
        $("#privatemailfolderslist").append($li);
    };

    var removePrivateFolder = function(id) {
        // remove from mailfolder list and move list
        var folder = mox.mail.getFolderFromMap(id);

        $("[data-internal-id='"+ folder.index +"']").remove();
        try {
            $("#privatemailfolderslist").listview("refresh");
            $("#movefolderlist").listview("refresh");
        } catch(e) {

        }
    };

    /**
     * add a folder to the list of move folders
     * @param title
     * @param internalid
     */
    var addPrivateFolderToMoveList = function(title, internalid) {

        var $li = $("<li>").attr("data-internal-id", internalid);

        var $link = $("<a>").attr({
            href: "#",
            "class": "font-color-1"
        });
        var $img = $("<div>").addClass("postbox-icon folder");

        var $span = $("<span>").text(title);
        $span.css("padding-left","40px");

        $img.addClass("folder-icon-position ui-li-thumb ui-li-icon");

        $link.append($img);
        $link.append($span);
        $li.append($link);
        $link.bind("tap", function(e){
            e.preventDefault();
            $(events).trigger("folder_selected", {folder: internalid});
        });
        $("#movefolderlist").append($li);
    };

    goBack = function() {
        // use browser history
        history.back();
    };
    // public
    ui.page = {
        goBack: goBack,
        addListContainer: function(conID, pageID) {
            if ($("#" + conID).length === 0) {
                $(pageID).html('<div id="' + conID + '"></div>');
            }
        },
        addPage : addMailfolderPage,
        enableButton: enableButton,
        actionEditButton: actionEditButton,
        getButtonState: function() {
            return buttonState;
        },
        addPrivateFolderToList: addPrivateFolderToList,
        addPrivateFolderToMoveList : addPrivateFolderToMoveList,
        removePrivateFolder: removePrivateFolder
    };

    /************ UI.MAIL PART ***********************/

    var updateCountBubbles = function() {
        var folders = localUserConfig.folderTree.standardMailFolders;
        // hide all counters
        $(".custom-list-count").hide();
        $("#my-inbox").badger();
        $("#my-postbox").badger();
        $("#my-calendar").badger();

        $.each(unreadMails, function(i, item) {

            if ((typeof(item) === "number") && item > 0) {

                switch (i) {
                    case folders["0_inbox"].id:

                        $("#my-inbox").badger("" + item);
                        $("#mailfolderlist_inbox").next(".custom-list-count").show().text("" + item);
                        break;
                    case folders["1_sent"].id:
                        $("#mailfolderlist_sent").next(".custom-list-count").show().text("" + item);
                        break;
                    case folders["2_drafts"].id:
                        $("#mailfolderlist_drafts").next(".custom-list-count").show().text("" + item);
                        break;
                    case folders["3_spam"].id:
                        $("#mailfolderlist_spam").next(".custom-list-count").show().text("" + item);
                        break;
                    case folders["4_trash"].id:
                        $("#mailfolderlist_trash").next(".custom-list-count").show().text("" + item);
                        break;
                    default:
                        // for all the non standard folders
                        var internalid = mox.mail.getFolderFromMap(i);
                        $('[href="#mf_' + internalid.index + '"] > .custom-list-count')
                            .show().css("display","inline-block").text(""+item);
                }
            }
        });
        // all private mail folders are collected under "own folders"
        if (unreadMails.allPrivate() > 0) {
            $("#mailfolderlist_private").next(".custom-list-count").show().text("" + unreadMails.allPrivate());
        }

        if (unreadMails.all() > 0) {
            $("#my-postbox").badger("" + unreadMails.all());
        }
        if (mox.calendar.newAppointments.length > 0) {
            $("#my-calendar").badger("" + mox.calendar.newAppointments.length);
        }
    };
    /**
     * adds a new row in the mail form to
     * display added contacts
     */
    var addToRow = function(field) {
        var $row = $("<tr>").addClass("mail-detail-row-bg");
        var $td = $("<td>").attr("colspan","2")
            .addClass("newmail-table inputcontainer row-selector table-border-color table-border b");
        var $tolabel= $("<td>")
            .addClass("newmail-table label-front table-border-color table-border b")
            .attr({
                "data-selector": field,
                "data-actual": "false"
            });

        $row.append($tolabel);
        $row.append($td);
        $("#newmail-" + field + "-table").prepend($row);
        moveTableLabelToFirstRow(field);
        return $row;
    };

    // move the label to first row
    var moveTableLabelToFirstRow = function(field) {

        var label = '';
        switch (field) {
            case "to": label = "To:";
                    break;
            case "cc": label = "Cc:";
                    break;
            case "bcc": label = "Bcc:";
                    break;
        }

        var $table = $("#newmail-" + field + "-table");
        var $tr = $table.find("tr");
        var $tofield = $($tr).find("[data-selector="+ field + "]").not("[data-actual=false]");
        $tofield.text("");
        $($tr[0]).find("[data-selector="+ field + "]").attr("data-actual","true").text(_i18n(label).toString());
    };


    ui.mail = {

        updateCountBubbles: updateCountBubbles,

        getActualFolder: function() {
            return actualFolderShowing;
        },
        newmail: {
            addToRow: function(field) {
                return addToRow(field);
            },
            moveTableLabelToFirstRow: moveTableLabelToFirstRow
        }
    };
}());
/**
 * A generic list selection widget class
 * It's tied to the "offline/online" state
 */
var ListSelect = function(options) {
    this.nodes = [];
    this.options = $.extend({
        id: "ui-listSelect",
        multiple: false
    }, options || {});
    this.selected = [];
    // default selected?
    if (this.options.defaultSelected) {
        this.selected = this.options.defaultSelected;
        // not an array? take care we have the right format
        if ($.isArray(this.options.defaultSelected) === false) {
            this.selected = [ this.options.defaultSelected ];
        }
    }
    this.container = this.options.container ||
        $("<ul/>").attr({ "data-role": "listview",
            "data-inset" : "false", id: this.options.id });
};

ListSelect.prototype = {

    add: function (options) {
        var node = this._createItem(options);
        if (options.index) {
            this.nodes.splice(options.index, 0, node);
        } else {
            this.nodes.push(node);
        }
        this.container.append(node);
        // is selected?
        if ($.inArray(this.length(), this.selected) !== -1) {
            node.tap();
        }
    },
    
    get: function (index) {
        return this.nodes[index];
    },
    
    length: function () {
        return this.nodes.length;
    },
    selectById: function(idlist, state) {
        var Self = this;
        $.each(this.nodes, function(i, elem) {
            var data = $(elem).data();
            if (_.indexOf(idlist, data.data.folder) !== -1) {
                var a = $(elem).attr("ox-select-id");
                a = a.substr(3);
                Self.select(a, true);
            }
        });
    },
    select: function(index, silentMode) {
        if (online) {
            var silent = (silentMode !== undefined) ? silentMode : false;
            var items = index;
            
            if ($.isArray(index) === false) {
                items = [ index ];
                
            } else if (this.options.multiple === false) {
                // non-multiple allow only one selected item
                items = [ items[0] ];
                this.selected = items;
            }
            
            // de-select all first if no multiple
            if (this.options.multiple === false) {
                $('li[selected="selected"]', this.container)
                .removeClass("font-color-1")
                .removeAttr("selected")
                .find("div.list-icon-select").hide();
            }
            // select new ones
            for (var i=0; i < items.length; i++) {
                // getting node
                var node = this.get(items[i]);
                
                // multiple handle
                if (this.options.multiple === true && node.attr("selected") !== undefined) {
                    // deselect only when multiple enabled
                    node.removeClass("font-color-1")
                    .removeAttr("selected")
                    .find("div.list-icon-select").hide();
                    // remove from selection if required
                    var idx = $.inArray(""+ items[i], this.selected);
                    if (idx !== -1) {
                        this.selected.splice(idx,1);
                    }
                } else {
                    // select item
                    node.addClass("font-color-1")
                    .attr("selected", "selected")
                    .find("div.list-icon-select").show();
                    // just to make sure it's not duplicated
                    if ($.inArray(items[i], this.selected) === -1) {
                        // push to selection
                        this.selected.push("" + items[i]);
                    }
                }
                
                // trigger changeEvent
                if (this.options.onChange && !silent) {
                 
                    this.options.onChange(
                        this,
                        $.extend(node.data("data"), { index: index }),
                        this.selected
                    );
                }
            }
        } else {
            ui.showOfflineMessage();
        }
    },
    
    /*
     * internal helper class to create a list node
     */
    _createItem: function(options) {
        var id = (options.id || this.length()),
            selected = false;
        if (options.data && options.data.selected) {
            selected = options.data.selected;
        }
        var $visibleContent;
        var customIconClass = "";
        if (!options.html) {
            $visibleContent = $("<div/>")
                .text(options.value)
                .addClass("selectlist-label");
           
        } else {
            $visibleContent = options.html;
            if (options.customIconClass) {
               customIconClass = options.customIconClass;
            }
        }
        
        var node = $("<li/>")
            .attr({ 
                "ox-select-id": "OX." + id
            })
            .addClass("ui-btn-up-c" + (selected === true ? " font-color-1" : ""))
            .hover(function () {
                    $(this).removeClass("");
                    $(this).addClass("ui-btn-hover-custom");
                },
                function () {
                    $(this).addClass("");
                    $(this).removeClass("ui-btn-hover-custom");
                }
            )
            .append($visibleContent)
            .append($("<div/>")
                    .addClass("list-icon-select right " + customIconClass)
                    .css({ 
                        display: (selected === true ? "" : "none")
                    })
            )
            .data("data", options.data || {});
        // mark node as selected
        if (selected) {
            node.attr("selected", true);
        }
        var Self = this;
        // disabled, no change event required
        if (options.disabled === true) {
            node.attr("disabled", "disabled");
        } else {
            // bind to change event
            node.bind("tap", options, function(e) {
                // select it
                Self.select(options.key);
                e.preventDefault();
            });
        }
        return node;
    }
};
/**
 * All content on this website (including text, images, source code and any
 * other original works), unless otherwise noted, is licensed under a Creative
 * Commons License.
 * 
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * 
 * Copyright (C) 2004-2010 Open-Xchange, Inc. Mail: info@open-xchange.com
 * 
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

/**
 * Autocomplete Plugin for jQuery
 * Special written for OX Mobile Web Interface
 */
(function( $ ){

    $.fn.autocomplete = function( list, options ) {
        var defaults = {
                maxelements: 3,
                field: "to",
                threshold : 1
        };
        $.extend(defaults, options);
        
        var $listcontainer = $("<div>");
        var fieldPosition = this.position();
        var fieldWidth = this.width();
        var fieldHeight = this.parent().height();
        var self = this;
        var maillist = list;
        var mailNodes = { };
        var actualShowing = 0;
        
        $listcontainer
            .addClass('mail-autocomplete')
            .css({
                "top": ( fieldPosition.top + fieldHeight + 5 ) + "px",
                "left": fieldPosition.left + "px",
                "width" : ( fieldWidth - 2 ) + "px"
            });
        
        $("body").append($listcontainer.hide());
        
        var updateSize = function() {
            fieldWidth = self.width();
            $listcontainer.css("width", ( fieldWidth - 2 )+ "px");
        };
        
        var addAddress = function(address, text) {
            text = text || address;
            var v = address;
            switch (defaults.field) {
                case "to": 
                    mox.mail.newMail.addTo(v);
                    mox.mail.addMailRecipient("to", v, text);
                    break;
                case "cc":
                    mox.mail.newMail.addCC(v);
                    mox.mail.addMailRecipient("cc", v, text);
                    break;
                case "bcc":
                    mox.mail.newMail.addBCC(v);
                    mox.mail.addMailRecipient("bcc", v, text);
            }
            
        };
        
        var filter = function(string) {
            _.debug(string);
            var templist = []; 
            for (var i = 0; i < maillist.length; i++) {
                if(maillist[i].search.toLowerCase().indexOf( string ) !== -1) {
                    templist.push(maillist[i].mail);
                }
            }
            return templist;
        };
        
        var show = function() {
            if ( actualShowing > 0 ) {
               
                fieldPosition = self.position();
                fieldWidth = self.width();
                fieldHeight = self.parent().height();
                fieldWidth = self.width();
               
                $listcontainer.css({
                    "top": ( fieldPosition.top + fieldHeight + 5 ) + "px",
                    "left": fieldPosition.left + "px",
                    "width": fieldWidth
                });
                $listcontainer.show();
            } else {
                hide();
            }
        };
        
        var hide = function() {
            $listcontainer.hide();
        };
        
        var update = function(list) {
          $listcontainer.empty();
          actualShowing = list.length;
          
          for (var i = 0; i < defaults.maxelements; i++) {
              $listcontainer.append(mailNodes[list[i]]);
          }
          if (list.length > defaults.maxelements) {
              $listcontainer.append($("<div>").addClass("ellipsis").text("..."));
          }
        };
        
        var readList = function() {
            
            var handler = function(e) {
                e.preventDefault();
                $(self).val(e.data.text);
                hide();
                addAddress(e.data.text, e.data.display);
                self.val("");
            };
            
            mailNodes = {};
            
            for (var i = 0; i < maillist.length; i++) {
                mailNodes[maillist[i].mail] = $('<div class="contact-bubble-border">')
                    .append($('<div>')
                        .append($('<div>').addClass('displayname').text(maillist[i].display))
                        .append($('<div>').addClass('email').text(maillist[i].mail))
                        // must use touchstart, tap is too late
                        .bind("touchstart mousedown", {text: maillist[i].mail, display: maillist[i].display }, handler)
                    ).css('marginBottom', '3px');
            }
        };
        
        var processField = function() {
            if ( self.val().length > 0 ) {
                addAddress(self.val());
                self.val("");
            }
        };
        
        var blurAction = function(e) {
            e.preventDefault();
            processField();
            hide();
        };

        readList();
        
        $(events).bind("email-list-update", function() {
            readList();
        });
        
        this
            .bind("blur", blurAction)
            .bind("keyup", function(e) {
                if ( $(this).val().length >= defaults.threshold ) {
                   updateSize();
                   var list = filter($(this).val());
                   readList();
                   update(list);
                   show();
                } else {
                   hide();
                }
            });
    };
})( jQuery );

/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2004-2010 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

// extend namespace for module folders
mox.folder = { };

/*********************************************
 ******Implementation*************************
 *********************************************/

/**
 * isBlacklisted
 * lookup blacklist for a folder
 * @param id the folder id
 */
/*
mox.folder.isBlacklisted = function(id) {
    return ($.inArray(id, localUserConfig.folderTree.blacklist) === -1) ? false : true;
};
*/

mox.folder.getFolderName = function(id) {
    var standardfolders = localUserConfig.folderTree.standardMailFolders;
    var mailfolders = localUserConfig.folderTree.mailFolders;
    var name = '';
    $.each(standardfolders, function(i, elem) {
        if (elem.id === id) {
            name = elem.title;
        }
    });

    $.each(mailfolders, function(i, elem) {
        if (elem.folder === id) {
            name = elem.title;
        }
    });
    return name;
};


/**
 * gets all visible folders in flat view
 * @param {Object} options extend ajax options
 * @param {Object} callback function to call after successful loading
 */
mox.folder.getVisibleFolders = function(options, callback) {
    _.debug("getVisibileFolders", options);

    var defaults = {
        content_type: "mail",
        columns: "1",
        mailRootFolders: false,
        session: session
    };

    $.extend(defaults, options);

    var url = HOST + '/folders?action=allVisible';
    _.each(defaults, function (value, key) {
        url = url + '&' + key + '=' + value;
    });

    $.ajax({
        type: "PUT",
        url: url,
        success: function (data) {
            if (data.data) {
                if (typeof(callback) === "function") {
                    callback(data);
                }
            } else {
                mox.error.handleError(data);
            }
        },
        dataType: "json"
    });
};

/**
 * get all folders
 * @param {Object} folders
 * @param {Object} id
 */
mox.folder.getFolders = function() {
    _.debug("getFolders");
    var columns = "1,301,300,307,304,306,302,305,308,311,2,314,315,313,315,308,20,309";

    /*
     * MAIL
     */
    mox.folder.getVisibleFolders({
        columns: "1,314,305,300,316,311",
        content_type: "mail"
    }, function(data) {
        if (data.data["private"]) {
            $.each(data.data["private"], function(i, elem) {
                var perm = util.getPermission(elem[2], 7);
                // standard folder?
                if (elem[4] !== 0) {
                    // add folder title to list
                    $.each(localUserConfig.folderTree.standardMailFolders, function(k, j) {
                        if (j.id === elem[0]) {
                            j.title = elem[3];
                        }
                    });
                }

                // initial values for unread elements
                unreadMails[elem[0]] = elem[5];

                // don't take standard folders, folders without permissions unsubscribed folders
                // this will be the list displayed for folder selection
                if (elem[1] && (perm.bit !== 0) && (elem[4] === 0)) {

                    localUserConfig.folderTree.mailFolders.push({
                        folder: elem[0],
                        rights: elem[2],
                        title: elem[3]
                    });
                }
            });
            $(events).trigger("folders-mail-loaded");
        }
        // finally, get all
        mox.mail.getAllMailFolders();
    });
    // don't do the calendar stuff if no calendar module is available
    if (localUserConfig.activeModules.calendar === true) {
        /*
         * CALENDAR
         */
        mox.folder.getVisibleFolders({
            columns: columns,
            content_type: "calendar"
        }, function (e) {
            if (localUserConfig.activeModules.calendar) {

                var folders_temp = e.data["private"];
                var folders = [];
                var perm;
                $.each(folders_temp, function(i, elem) {
                    /*
                    // Blacklisting
                    var folderid = elem[0];
                    var isBlacklisted = mox.folder.isBlacklisted(folderid);
                    */
                    perm = util.getPermission(elem[7], 7);

                    if (perm.bit !== 0) {
                        // this folder is not yet drawn to list
                        //elem.push(false);
                        folders.push(elem);
                    }

                });

                localUserConfig.folderTree.calendarFolders = folders;
                mox.calendar.getAppointmentList(localUserConfig.appointmentDays);
            } else {
                // probably PIM
                // no calendar module
                // TODO unbind calendar module
                //$("#my-calendar").addClass("ui-disabled");

            }
            try{
                if(storage.getMode() !== 0) {
                    storage.setItem("folderTree", localUserConfig.folderTree, true);
                }
            }catch(e){
                mox.error.newError("[Storage] Error during save", e);
            }
        });
    } else {
        // disable calendar features in ui
        $("#my-calendar").addClass("ui-disabled");
        $("[href=#settings-calender]").addClass("ui-disabled");
    }
    /*
     * CONTACTS
     */
     mox.folder.getVisibleFolders({
        columns:columns,
        content_type: "contacts"
    }, function (e) {

        var folderPrivate = (e.data["private"] === undefined) ? [] : e.data["private"];
        var folderPublic = (e.data["public"] === undefined) ? [] : e.data["public"];

        var all_temp = folderPrivate.concat(folderPublic);
        var all = [];
        var bits, perm;
        // remove folders without permissions and blacklisted ones
        $.each(all_temp, function(i, elem) {
            // Blacklisting, not enabled yet
            /*
            var folderid = elem[0].toString();
            var isBlacklisted = mox.folder.isBlacklisted(folderid);
           */
            bits = elem[7];
            // calculate permissions
            perm = util.getPermission(bits, 7);
            if (perm.bit !== 0) {
                all.push(elem);
            } else {
                // do something with folders we don't have access to
            }
        });

        $.each(all, function(i, elem) {

            mox.contacts.contactFolders[elem[0]] = {
                    data: elem
            };
            /*
            elem.push({
                "fetched" : false,
                "getFolder" : false
            });
            */
        });

        if (storage.getMode !== 0) {
            storage.setItem("contactFolders", mox.contacts.contactFolders, true);
        }

        localUserConfig.folderTree.contactFolders = all;
        $(events).trigger("folders-contacts-loaded");

        /*
         * try to get all folders which are subscribed
         * if a folder has been deleted or moved on backend
         * remove this folder from list and show error message
         */
        var found = false;
        var wrongFolders = [];
        var rightList = [];
        $.each(localUserConfig.subscribedFolders.contacts, function(i, folder) {
            $.each(all, function(j, folder_j){
                if(folder_j[0] === folder) {
                    found = true;
                    rightList.push(folder);
                }
            });
            if (found === false) {
                mox.error.newError("Error: [Contacts] Subscribed folder " + folder +
                        " not found on server. Removing from list." );
                wrongFolders.push(folder);
            }
        });
        localUserConfig.subscribedFolders.contacts = rightList;

        try{
            if(storage.getMode() !== 0) {
                storage.setItem("folderTree", localUserConfig.folderTree, true);
            }
         }catch(e){
            mox.error.newError("[Storage] Error during save", e);
         }

         // get merged list of contacts
         mox.contacts.initContacts();

    });


};
/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2004-2010 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

mox.error = {
    counter: 0,
    errorlog: { },
    newError : function(error) {
        this.counter++;
        this.errorlog["error_" + this.counter] = error;
        $("#errorlogbody").append($("<p>")
                .text(formatDate(new Date(), "datetime").toString() + ": "+ error))
                .addClass("errormessage");
    },
    clearLog : function() {
        this.errorlog = {};
        this.counter = 0;
    },
    showErrorLog : function() {
        var log = "";
        $.each(this.errorlog, function(number, error) {
            log += number +": " + error + "<br>";
        });
        return log;
    },
    sendErrorLog: function() {
        var text = "ERRORLOG\n";
        text += "**********************************************\n";
        text += "Product: " + mox.product.product_name + "\n";
        text += "Version: " + mox.product.pversion + "\n";
        text += "Date: " + format(new Date(), "datetime").toString() + "\n";
        text += "**********************************************\n";

        $.each(this.errorlog, function(i, elem) {
            text += elem + "\n";
        });

        $("#mail-text-area").val(text);
        $.mobile.changePage("#newmail", {transition:  transitions.slideup});
    },
    handleError : function(e, callback) {
        _.debug('mox.error.handleError before check: ', e);
        ui.blockScreen(false);
        mox.refreshing = false;
        var cb = $.noop;
        if (typeof(callback) === "function") {
            cb = callback;
        }
        /* pageloading */
        if (e.code && e.error_id) {
            if(e.code.match(/^SES-02..$/)) {
                // only do this if we are not starting from a previous offline mode
                // session
                if (session !== "offline") {
                    _.debug(3, 'mox.error.handleError - SES-02..: ', e);
                    mox.error.newError("[RELOGIN] " + format(e.error,e.error_params));

                    mox.login.performRelogin = true;
                    var $cancelButton = $("<button>").attr({
                        "id" : "relogin_cancel"
                    }).text(_i18n("Cancel").toString());

                    $("#reloginlabel").remove();
                    $("#relogin_cancel").parent().remove();
                    $("#user").removeAttr("readonly").val("").removeClass("ui-disabled");

                    $("#logincontent").prepend(
                            $("<h4>")
                                .text(_i18n("Your session expired.").toString())
                                .css("text-align","center")
                                .attr("id", "reloginlabel"));

                    $("#logincontent").append($cancelButton);
                    $cancelButton.bind("tap", function(e) {
                        e.preventDefault();
                        mox.login.cancelRelogin();
                    });
                    $cancelButton.button();

                    if (localUserConfig.loginName) {
                        $("#user").val(localUserConfig.loginName)
                            .attr("readonly", "readonly")
                            .addClass("ui-disabled");
                    }
                    if ($.mobile.activePage.attr("id") !== "login") {
                        $.mobile.changePage("#login", {transition: transitions.slideup});
                    }
                } else {
                    if ($.mobile.activePage.attr("id") !== "login") {
                        $.mobile.changePage("#login", {transition: transitions.slideup});
                        window.location.reload();
                    }
                }

            } else if ( e.code === "LGI-0006" ) {
                _.debug(3, 'mox.error.handleError - LGI-0006..: ', e);
                // count the failed logins


                /*
                mox.login.failedLogins++;
                if (mox.login.failedLogins === mox.login.MAXFAILEDLOGINS) {
                    ui.showAlertBox(_i18n('Your E-Mail address or password is wrong. Do you want to type your password in clear text?').toString(),
                    {
                        buttons: [
                            {
                                text: _i18n('Yes').toString(),
                                action: function () {
                                    mox.login.enableEasyPasswordField('true');
                                },
                                primary: true
                            },
                            {
                                text: _i18n('No').toString(),
                                action: $.noop,
                                primary: false
                            }
                        ]
                    });
                }
                */

                mox.error.newError("[LOGIN] " + format(e.error,e.error_params));
                ui.showAlertBox(_i18n("Your E-Mail address or password is wrong.").toString(),
                {
                    buttons: [
                    {
                        text: _i18n("Ok").toString(),
                        action: cb,
                        primary: true
                    }
                    ]
                });

            } else if( e.code.match(/^CON-/) ) {
                _.debug(3, 'mox.error.handleError - CON : ', e);
                mox.error.newError("[GENERIC] " + format(e.error,e.error_params));
            } else {
                ui.showAlertBox(_i18n("An error occurred. Please try again.").toString(), {
                    buttons: [
                              {text: _i18n("Ok").toString(),
                               action: cb
                              }
                           ]});

                mox.error.newError(format(e.error,e.error_params));

            }
        } else if (e.status === 0) {
            _.debug(3, 'mox.error.handleError - status == 0: ', e);
           // this error occures often when cache.manifest has the
           // wrong network directive
            ui.showAlertBox(_i18n("An error occurred.").toString(), {
                buttons: [
                          {text: _i18n("Ok").toString(),
                           action: cb
                          }
                       ]});

            mox.error.newError("[CONNECTION] Connection problem, received response code 0.");


        } else if (e.status && e.statusText) {
            _.debug(3, 'mox.error.handleError -generic 1: ', e);
            ui.showAlertBox(_i18n("An error occurred.").toString(), {
                buttons: [
                          {text: _i18n("Ok").toString(),
                           action: cb
                          }
                       ]});

            mox.error.newError("[CONNECTION] " + e.status +" - " + e.statusText);

        } else {
            _.debug(3, 'mox.error.handleError - generic 2: ', e);
            ui.showAlertBox(_i18n("An error occurred. Please try again.").toString(), {
                buttons: [
                          {text: _i18n("Ok").toString(),
                           action: cb
                          }
                       ]});
            mox.error.newError(format(e.error, e.error_params));
        }
    }
};

/**
 * Simple error-handler for filling the standard error
 * page with text and sliding it up
 * @param requestObject
 * @param
 * @param errorThrown unused
 */
var errorHandler = mox.error.handleError;


mox.config = { };

/**
 * DEVELOPMENT
 * get only mox config from backend
 */
mox.config.getMOXConfig = function () {
    $.ajax({
        url: HOST + '/config/mox?session=' + session,
        type: 'get',
        dataType: 'json'
   });
};

/**
 * store localUserConfig to localStore
 */
mox.config.storeConfig = function () {
    try {
        if (storage.getMode() !== 0) {
            storage.setItem("config", localUserConfig, true);
        }
    } catch (e) {

    }
};

/**
 * Saves relevant user data on backend and in localStorage
 * @param {Object} options Object containing callback and errorCallback function, optional
 */
mox.config.saveLocalUserConfig = function (options) {
    defaults = {
        callback: eF,
        errorCallback: function(e){
            gui.customToast(_("Error during save"));
            mox.error.newError("[CONFIG] Error during save, " +e);
        }
    };

    $.extend(defaults, options);
    requestBody = [];

    config = {
        mox: {
            config: {
                mailCount: localUserConfig.mailCount,
                appointmentDays: localUserConfig.appointmentDays
            },
            subscribedFolders: {
                contacts: localUserConfig.subscribedFolders.contacts,
                mail: localUserConfig.subscribedFolders.mail,
                calendar: localUserConfig.subscribedFolders.calendar
            }
        }
    };
    try {
        if (storage.getMode() !== 0) {
            storage.setItem("config", localUserConfig, true);
        }
    } catch (e) {
        // nope
    }
    if (online) {
        $.ajax({
            url: HOST +"/config?session="+session,
            success: function(e) {
                if(e){
                    if(e.error) {
                        defaults.errorCallback();
                        mox.error.newError("[CONFIG] Error during save, " + format(e.error, e.error_params));
                    }
               } else {
                   defaults.callback();
               }
            },
            type: "put",
            data: JSON.stringify(config),
            dataType: "text"
        });
    } else {
        if (storage.getMode() !== 0) {
            try {
                storage.setItem("offlineChanges", true, true);
            } catch (e) {
                mox.error.newError("[STORAGE] Error during store of config.");
            }
        }
        defaults.callback();
    }
};

/**
 * getUserConfig
 * load the user config from backend via multiple
 */
mox.config.getUserConfig = function () {
    _.debug(2, "mox.config.getUserConfig");
    try {
        if (storage.getMode() !== 0) {
           // storage.flushStorage();
            _.debug(2,'flushStorage in getUserConfig deactivated');
        }
    }
    catch (e) {
        //nothing
    }
    var requestData = [
        {module: "config/mox"},
        {module: "config/mail/folder"},
        {module: "config/folder"},
        {module: "config/language"},
        {module: "config/identifier"},
        {module: "config/currentTime"},
        {module: "config/mail/sendaddress"},
        {module: "config/login"}
    ];

    var successHandler = function (data, response) {
        if (data.error) {
           mox.error.handleError(data);
        } else {

            // if FAILSAFE is enabled, skip getting subscribed folders from backend
            if ( data[0].data && !util.isFailSafe() ) {
                localUserConfig.subscribedFolders = data[0].data.subscribedFolders;
                localUserConfig.mailCount = data[0].data.config.mailCount;
                localUserConfig.appointmentDays = data[0].data.config.appointmentDays;
                // standard folder for contacts is the standard private folder for contacts
                localUserConfig.defaultContactStoreFolder = data[2].data.contacts;
                if (localUserConfig.subscribedFolders.contacts.length === 0) {

                    var defaultContacts = data[0].data.config.defaultContactFolder || 'private';
                    switch (defaultContacts) {
                        case 'none':
                            // do nothing
                            break;
                        case 'private':
                            localUserConfig.subscribedFolders.contacts.push(data[2].data.contacts + '');
                            break;
                        case 'global':
                            localUserConfig.subscribedFolders.contacts.push('6');
                            break;
                    }
                }

                try {
                    if (storage.getMode() !== 0) {
                        storage.setItem("config", localUserConfig, true);
                    }
                } catch (e) {
                    // nope
                }

            } else if (!util.isFailSafe()) {
                mox.error.newError("[CONFIG] Warning: No mobile app config found on server!");
            } else {
                mox.error.newError("[CONFIG] Running in failsafe mode, ignoring server config!");
            }


            // default folders for mail
            // sort them in the same way ox gui does
            var d = data[1].data;
            var temp = {
                "0_inbox" : {id: d.inbox},
                "1_sent" : {id: d.sent},
                "2_drafts" : {id: d.drafts},
                "3_spam" : {id: d.spam},
                "4_trash" : {id: d.trash}
            };

            localUserConfig.folderTree.standardMailFolders = temp;


            // getting own user ID
            userID = data[4].data;

            try {
                if (storage.getMode() !== 0) {
                    storage.setItem("userID", userID, true);
                }
            } catch (e) {
                // nope
            }

            // get time from server and calculate offset
            if (data[5]) {
                mox.calendar.now();
                mox.calendar.now.offset = data[5].data - (new Date()).getTime();
            }

            // getting default senderaddress
            if (data[6]) {
              localUserConfig.senderaddress = data[6].data;
            }
            if (data[7]) {
                localUserConfig.loginName = data[7].data;
            }
            mox.config.storeConfig();
            getUserData();
        }

    };

    $.ajax({
        url: HOST + "/multiple?session=" + session,
        data: JSON.stringify(requestData),
        success: successHandler,
        error: errorHandler,
        type: "PUT",
        dataType: "json"
    });

    // after we got the userID from the config we can now ask
    // the user interface for more details about the user
    var getUserData = function() {
        var url = HOST + "/user";
        var successHandler = function(data) {
            if (data.error) {
                mox.error.handleError(data);
            } else {
                userData = data.data;
                try {
                    if (storage.getMode() !== 0) {
                        storage.setItem("userData", data.data, true);
                    }
                }
                catch (e) {
                    mox.error.newError("[STORAGE] Error during save, " + e);
                }
                // save language
                localUserConfig.lang = userData.locale;

                // save login name
                localUserConfig.username = userData.login_info;

                // only change language if not already set by default
                if ( current_lang !== localUserConfig.lang ) {
                    setLanguage(localUserConfig.lang, function() {
                        mox.init.setLanguageTags(true);
                        $.mobile.initializePage();
                    });
                }
                // trigger config loaded event
                $(events).trigger("config-loaded");

                // after all userdata is fetched we can start fetching
                // mails etc from server. This is triggered in initAfterLogin();
                mox.login.initAfterLogin();
            }
        };

      $.ajax({
            url: url,
            data: {
                "action": "get",
                "session": session,
                "id": userID
            },
            success: successHandler,
            error: errorHandler,
            type: "get",
            dataType: "json"
        });
    };

};

/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

var AppointmentListView = function(container) {

    var $container = $("#app_list");

    var $listnode = $("<ul>").attr({
        "data-role": "listview",
        "data-inset": true,
        "id": "calendarListView"
    });

    var listitems = [], newList = true, tempDate = new Date(), todaysep = false, needRedraw = false;
    var emptyMessage = _i18n("No upcoming appointments.").toString();
    // empty node
    $($container).empty().append($listnode);

    var parseData = function(data) {
        var appObj = {};
        $.each(mox.calendar.getColumnsList, function(i, elem) {
            var d = mox.calendar.resolveField(elem);
            appObj[d] = data[i];
        });
        // extra field showOnDay, no backend field, just for us to know when we have to show
        // multiple rows for one appointment
        if (data[27]) {
            appObj.showOnDay = data[27];
        } else {
            appObj.showOnDay = data[7];
        }

        return appObj;
    };
    // delegate on list to handle taps
    $('#app_list').on('tap', 'li', function (e) {
        e.preventDefault();
        var id = $(this).data('data-app-id'),
            recPos = $(this).data('data-app-rec-pos') || -1;
        if (id === undefined) return; // not a list elem

        appointmentViewer.showAppointment(id, recPos, function () {
              //callback
            $.mobile.changePage("#appointmentdetail", {transition: transitions.slide});
        });
    });

    var addRow = function(data) {

        var $item = $("<li>").addClass("appointment"),
            $link = $("<a>").attr('href', '#').css("padding-left","30px"),
            startdate = new Date(data.start_date),
            enddate = new Date(data.end_date),
            $location = $("<div>").addClass("appointment location").html('&nbsp;').text(data.location || null),
            $title = $("<div>").addClass("appointment title").text(data.title || _i18n("Untitled appointment").toString()),
            $time = $("<div>").addClass("appointment time"),
            $marker = $("<div>").addClass("appointment-new");

        if (data.state === "new") {
            $link.append($marker);
            // count new appointments via IDs in an array
            if ($.inArray(data.id, mox.calendar.newAppointments) === -1) {
                mox.calendar.newAppointments.push(data.id);
            }
            ui.mail.updateCountBubbles();
        } else if (data.state === "declined") {
            $title.css("text-decoration","line-through");
        }

        if (data.full_time) {
            // full time for one day
            var timeString = _i18n("All day").toString();

            if (!util.date.equalsDay(startdate, enddate)) {
                // all day for multiple days
                timeString = _i18n('All day').toString() + ': ' +formatDate(startdate,"date").toString() + " - " + formatDate(enddate,"date").toString();
            }

            $time.text(timeString);
        } else if (util.date.equalsDay(startdate, enddate)) {
            // start and end on same day
            $time.text(formatDate(startdate,"time").toString() + " - " + formatDate(enddate,"time").toString());
        } else {
            // longer than one day
            $time.text(formatDate(startdate,"datetime").toString() + " - " + formatDate(enddate,"datetime").toString());
        }

        $item.append($link.append($time, $location, $title));

        $listnode.append($item);
        // save appointment data via $.data for delegate
        $item.data({
            'data-app-id': data.id,
            'data-app-rec-pos': data.recurrence_position
        });

        // add to list
        listitems.push({data: data, node: $item});
    };

    // add a divider to the list
    var addDivider = function(date) {

        var item = $("<li>");
        if (date !== "today") {
            item.text(formatDate(date, "date").toString());
        } else {
            item.text(_i18n("Today").toString());
        }
        item.attr("data-role","list-divider");
        item.addClass("contactlist-separator-bg");
        $listnode.append(item);
    };

    var getNextApp = function(actualPos) {
        if (actualPos === listitems.length - 1) {
            // no more to show
            return -1;
        } else {
            var k = listitems[actualPos+1].data;
            return {id: k.id, recPos: k.recurrence_position, data: k};
        }
    };

    var getPrevApp = function(actualPos) {
        if (actualPos === 0) {
            // no more to show
            return -1;
        } else {
            var k = listitems[actualPos-1].data;
            return {id: k.id, recPos: k.recurrence_position, data: k};
        }
    };

    var getListPositionbyIdAndRecurrence = function(id, rp) {
        var pos = -1;
        $.each(listitems, function(i, elem) {
            if (elem.data.id == id && elem.data.recurrence_position === rp) {
                pos = i;
            }
        });
        return pos;
    };

    var getListPosition = function(id) {
        var pos = -1;
        $.each(listitems, function(i, elem) {
            if (elem.data.id == id) {
                pos = i;
            }
        });
        return pos;
    };

    var checkState = function(data) {
        return mox.calendar.checkOwnConfirmation(data);
    };

    var showEmptyMessage = function() {
        var $item = $("<li>").addClass("appointment");
        $item.text(emptyMessage);
        $listnode.append($item);
    };

    var redrawList = function() {

        // take nodes from list and redraw listview
        emptyList();
        var startDate;
        var todaysep = false;
        var tempDate = new Date();

        for (var i = 0; i < listitems.length; i++) {

            var that = listitems[i];

            startDate = new Date(that.data.showOnDay);

            if (util.date.equalsDay(startDate, tempDate) && !todaysep) {
                // this is today
                addDivider("today");
                todaysep = true; // ensure there is only one separator "today"
            } else if ( startDate.getUTCDate() !== tempDate.getUTCDate() ) {
                // next day
                todaysep = true; // if first date was not today all next won't be, too
                addDivider(startDate);
            }

            $(that.node).data({
                'data-app-id': that.data.id,
                'data-app-rec-pos': that.data.recurrence_position
            });
            // append node to list again
            $("#calendarListView").append($(that.node));

            tempDate = startDate;
        }
        calendar.refresh();
    };
    // clear the list
    var emptyList = function() {
        $("#calendarListView").empty();
    };

    // update a single listitem matched by id
    var updateItem = function(raw) {
        var data = parseData(raw);
        for (var i = 0; i < listitems.length; i++) {
            var item = listitems[i];
            if (item.data.id === data.id && item.data.recurrence_position === data.recurrence_position) {
                // replace this one with new one
                item.data = data;
                updateNode(item.node, data);
            }
        }
        // list needs redraw
        needRedraw = true;
    };

    // update a listnode with given data
    var updateNode = function(node, data) {
        var $n = $(node), // the main node
            title = data.title || _i18n("Untitled appointment").toString(), // title
            startdate = new Date(data.start_date),
            enddate = new Date(data.end_date),
            $link = $n.find("a"),
            $title = $n.find(".title").text(title).css("text-decoration", "none"),
            $marker, $time = $n.find(".time");

        data.state = checkState(data);
        $n.find(".location").text(data.location); //update location

        if (data.state === "new") {
            $marker = $("<div>").addClass("appointment-new");
            $link.append($marker);
            mox.calendar.newAppointments++;
            ui.mail.updateCountBubbles();
        } else if (data.state === "declined") {
            $title.css("text-decoration","line-through");
        }
        if (data.state !== "new") {
            $n.find('.appointment-new').remove();
        }
        if (data.full_time) {
            $time.text(_i18n("All day").toString());
        } else if (util.date.equalsDay(startdate, enddate)) {
            $time.text(formatDate(startdate,"time").toString() + " - " + formatDate(enddate,"time").toString());
        } else {
            $time.text(formatDate(startdate,"datetime").toString() + " - " + formatDate(enddate,"datetime").toString());
        }

    };
    // delete an single item
    var deleteItem = function(id, recPos) {
        // go trough array in reverse order to keep index alive
        for (var i = listitems.length - 1 ; i >= 0; i--) {
            var item = listitems[i];
            if (item.data.id === id && item.data.recurrence_position === recPos) {
                listitems.splice(i, 1);
            }
        }
        // list needs a redraw
        needRedraw = true;
    };

    // comparator for date sorting
    var dateComparator = function(a, b) {
        return a.data.showOnDay - b.data.showOnDay;
    };

    // update list if needed
    var updateList = function() {

        _.debug(0, "updateList for Calendar", needRedraw);
        if (needRedraw) {
            // sort entries by startdate
            listitems.sort(dateComparator);
            // redraw
            redrawList();
            if (listitems.length === 0) {
                showEmptyMessage();
            }
            needRedraw = false;
            if (!newList) {
                // only redraw it if was drawn before
                calendar.refresh();
            }
        }

        $(events).trigger("calendar-listview-refreshed");
    };

    // bind to update event
    $(events).bind("calendar-update-ready", function() {
        updateList();
    });


    // public objects
    var calendar = {
        addRow: function(rawData) {
            var state = checkState(rawData);
            var data = parseData(rawData);
            var startDate = new Date(rawData[27]); // this is not the start date of the appointment, it's the date where it should occur in our list
            var endDate = new Date(data.end_date);
            data.state = state;

            if (util.date.equalsDay(startDate, tempDate) && !todaysep) {
                // this is today
                addDivider("today");
                todaysep = true; // ensure there is only one separator "today"
            } else if ( startDate.getUTCDate() !== tempDate.getUTCDate() ) {
                // next day
                todaysep = true; // if first date was not today all next won't be, too
                addDivider(startDate);
            }
            addRow(data);
            tempDate = startDate;
            needRedraw = true;
        },
        getRow: function(id) {

        },
        length : function() {
            return listitems.length;
        },
        refresh: function() {
            if ($('ul', $container).hasClass('ui-listview')) {
                $('ul', $container).listview('refresh');
           }
        },
        renew: function() {
            $('ul', $container).listview();
        },
        getNode: function() {
            return $listnode;
        },
        getItems: function() {
            return listitems;
        },
        getContainer: function() {
            return $container;
        },
        getListPosition: function(id) {
            return getListPosition(id);
        },
        getListPositionbyIdAndRecurrence: function(id, rp) {
            return getListPositionbyIdAndRecurrence(id, rp);
        },
        getNextApp: function(actual) {
            return getNextApp(actual);
        },
        getPrevApp: function(actual) {
            return getPrevApp(actual);
        },
        showEmptyMessage: function() {
            showEmptyMessage();
        },
        updateItem: function(data) {
            updateItem(data);
        },
        updateList: function() {
            updateList();
        },
        empty: function() {
            emptyList();
        },
        getState: function() {
            return needRedraw;
        },
        deleteItem: function(id, recPos) {
            deleteItem(id, recPos);
        },
        setNewList: function(state) {
            newList = state;
        },
        getNewList: function() {
            return newList;
        },
        redrawList: function() {
            redrawList();
        }
    };
    return calendar;
};

/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

var AppointmentViewer = function() {

    var $main = $("#app_main_detail_main").css("text-align","center"),
        $note = $("#app_main_detail_note"),
        $participants = $("#app_main_participants"),
        $titleNode = $("<li>").addClass("app-detail-bg"),
        $locationNode = $("<li>").addClass("app-detail-bg") // TODO remove inline style
            .css({
                "font-weight":"normal",
                "color": "#666"
            }),
        $dateNode = $("<li>").addClass("app-detail-bg"),
        $textNode = $("<li>").addClass("app-detail-bg"),
        $participantsNode = $("<li>").addClass("app-detail-bg"),
        app_id = null,
        folder_id = null,
        state,
        cap, // data as object
        listlength,
        listPosition = null,
        recurrencePosition = null,
        CONFIRM_MESSAGE = "",
        DECLINE_MESSAGE = "";

    /***************** BUTTONS ***************/

    $("#appup-btn").bind("tap", function(e) {
        e.preventDefault();
        showPrev();
    });

    $("#appdown-btn").bind("tap", function(e) {
        e.preventDefault();
        showNext();
    });

    $("#decline-appointment-button").bind("tap", function(e) {
        if (online) {
            e.preventDefault();
            deny();
        } else {
            ui.showOfflineMessage();
        }
    });

    $("#accept-appointment-button").bind("tap", function(e) {
        if (online) {
            e.preventDefault();
            accept();
        } else {
            ui.showOfflineMessage();
        }
    });

    /*************** FUNCTIONS ***************/
    var refresh = function() {
        $(".groupnode").collapsible();
        try {
            $($main).listview();
            $($note).listview();
            $($participants).listview();
        } catch (e) {
        }
        try {
            $($main).listview("refresh");
            $($note).listview("refresh");
            $($participants).listview("refresh");
        } catch (e) {
        }
    };

    var clear = function() {
        $main.empty();
        $note.empty();
        $titleNode.empty();
        $locationNode.empty();
        $dateNode.empty();
        $textNode.empty();
        $participants.empty();

        $("#decline-appointment-button, #accept-appointment-button, #appdown-btn, #appup-btn").removeClass("ui-disabled");
        $titleNode.css("text-decoration", "none");
    };

    var callback_resolveGroupUsers = function(nodeList, list) {
        return function() {
            // replace "Loading" string with resolved username
            for (var i = 0; i < list.length; i++) {
                nodeList[i].find(".textnode").text(mox.contextData.users[list[i]][1]);
            }
        };
    };

    var getParticipantsNode = function (cap) {
        var parti = cap.participants,
            confirmations = cap.users,
            $node = $("<li>").addClass("app-detail-bg");

        // in case name resolving did not work, don't display any names
        if (mox.contextData.users !== undefined) {

            $node.append($("<div>").text(_i18n("Participants:").toString())).append("<br>");

            if (online) {
                // loop through all participants
                for (var i = 0; i < parti.length; i++) {

                    var text = '', status, elem = parti[i];

                    if (elem.type === 1 && mox.contextData.users[elem.id][1]) {
                        // single user
                        text = mox.contextData.users[elem.id][1];
                    } else if (elem.type === 2) {
                        // user group

                        var group = mox.contextData.groups[elem.id],
                            grouptitle = group.display_name,
                            list = [], nodeList = [];

                        // genereate collapsible widget
                        text = $("<div>").attr({
                            "data-role" : "collapsible",
                            "data-mini" : "true",
                            "data-content-theme" : "c"
                        }).addClass("groupnode");

                        // show groupname as collapsible header
                        text.append("<h3>" + util.escapeHTML(grouptitle) + "</h3>");

                        // add all groupmembers to collapsible
                        for (var j = 0; j < group.members.length; j++) {
                            var uid = group.members[j], userState = null;

                            // lookup state for each groupmember
                            for (var k = 0; k < cap.users.length; k++) {
                                if (uid === cap.users[k].id) {
                                    userState = cap.users[k].confirmation;
                                    break;
                                }
                            }
                            // user already resolved
                            if (mox.contextData.users[uid] !== undefined) {
                                _.debug("users, ", userState, mox.contextData.users[uid]);
                                if (userState === 0) {
                                    text.append('<div class="calendar nostatuscolor"><div class="calendar-icon no-icon"></div>' +
                                            '<span class="groupspacer textellipsis">' +
                                            util.escapeHTML(mox.contextData.users[uid][1]) + '</span></div>');

                                } else if (userState === 1) {
                                    text.append('<div class="calendar acceptcolor"><div class="calendar-icon accepted"></div>' +
                                            '<span class="groupspacer textellipsis">' +
                                            util.escapeHTML(mox.contextData.users[uid][1]) + '</span></div>');
                                } else if (userState === 2) {
                                    text.append('<div class="calendar deniedcolor"><div class="calendar-icon declined"></div>'+
                                            '<span class="groupspacer textellipsis">' +
                                            util.escapeHTML(mox.contextData.users[uid][1]) + '</span></div>');
                                } else if (userState === 3) {
                                    text.append('<div class="calendar tentativecolor"><div class="calendar-icon no-icon">?</div>'+
                                            '<span class="groupspacer textellipsis">' +
                                            util.escapeHTML(mox.contextData.users[uid][1]) + '</span></div>');
                                }

                            } else {
                                // unknown user, look it up later and write "Loading" message instead of name
                                var $userName = '';

                                if (userState === 0) {
                                    $userName = $('<div class="calendar nostatuscolor" ><div class="calendar-icon no-icon"></div>'+
                                            '<span class="groupspacer textnode textellipsis">' +
                                            _i18n("Loading...").toString() + '</span></div>');
                                } else if (userState === 1) {
                                    $userName = $('<div class="calendar acceptcolor"><div class="calendar-icon accepted"></div>'+
                                            '<span class="groupspacer textnode textellipsis">' +
                                            _i18n("Loading...").toString() + '</span></div>');
                                } else if (userState === 2) {
                                    $userName = $('<div class="calendar deniedcolor"><div class="calendar-icon declined"></div>'+
                                            '<span class="groupspacer textnode textellipsis">' +
                                            _i18n("Loading...").toString() + '</span></div>');
                                } else if (userState === 3) {
                                    $userName = $('<div class="calendar tentativecolor"><div class="calendar-icon no-icon">?</div>'+
                                            '<span class="groupspacer textnode textellipsis">' +
                                            _i18n("Loading...").toString() + '</span></div>');
                                }
                                text.append($userName);
                                list.push(uid);
                                nodeList.push($userName);
                            }
                        }

                        if (list.length > 0) {
                            // resolve participants of group
                            mox.calendar.resolveUsers(list, callback_resolveGroupUsers(nodeList, list) );
                        }
                        // end of group handling
                    } else if (elem.type === 3) {
                        // resource

                        text = mox.contextData.resources[elem.id].display_name;

                    } else if (elem.type === 4) {
                        // resource group
                        // no handling at the moment
                    }

                    // external participant ?
                    if (elem.type === 5) {

                        // display name set?
                        if (elem.display_name && elem.display_name !== elem.mail) {
                            text = elem.display_name + ", " + elem.mail;
                        } else {
                            // only email is set
                            text = elem.mail;
                        }
                        status = mox.calendar.checkConfirmation(elem, cap.confirmations );
                    } else {
                        status = mox.calendar.checkConfirmation(elem, confirmations);

                    }

                    var $div = $("<div>")
                        .addClass("calendar participants")
                        .append($("<span>")
                        .addClass("calendarspacer")
                        .text(text));


                    if (elem.type === 1) {
                        // different states for internal users
                        switch (status) {
                            case 1:
                                // utf-8 check mark sign for accepted participants
                                $div.addClass("acceptcolor").prepend('<div class="calendar-icon accepted"></div>');
                                break;
                            case 2:
                                // utf-8 cross for denied participants
                                $div.addClass("deniedcolor").prepend('<div class="calendar-icon declined"></div>');
                                break;
                            case 3:
                                $div.addClass("tentativecolor").prepend('<div class="calendar-icon no-icon">?</div>');
                                break;
                            default:
                                $div.addClass("nostatuscolor").prepend('<div class="calendar-icon no-icon"></div>');
                                break;
                        }
                    } else if (elem.type === 2) {
                        // for groups "text" does contain a
                        // whole collapsible widget.
                        $div.append(text);
                    } else if (elem.type === 3){
                        // resource
                        $div.prepend('<div class="calendar-icon resource"></div>');
                    } else if (elem.type === 5) {
                        // external user
                        $div.prepend('<div class="calendar-icon external"></div>');
                    }
                    $node.append($div);

                }
            } else {
                $node.append($('<div>').text(_i18n('Not available').toString()));
            }
        }
        return $node;
    }

    /**
     * show a given appointment by ID and recurrence position
     */
    var showAppointment = function(id, rP, callback) {
        clear();
        var seriesInfo = null;
        recurrencePosition = rP || -1;
        app_id = id;

        cap = mox.calendar.getAppointmentByID(id, recurrencePosition);

        _.debug(1, 'showAppointment', id, rP, cap);

        listlength = globalAppointmentListView.length();
        if (recurrencePosition === -1) {
            listPosition = globalAppointmentListView.getListPosition(app_id);
        } else {
            listPosition = globalAppointmentListView.getListPositionbyIdAndRecurrence(app_id, recurrencePosition);
            seriesInfo = new SeriesObject(cap, true);
        }
        if (listlength - 1 === listPosition) {
            $("#appdown-btn").addClass("ui-disabled");
        }
        if (listPosition === 0) {
            $("#appup-btn").addClass("ui-disabled");
        }
        if (listlength === 1) {
            $("#appup-btn, #appup-btn").addClass("ui-disabled");
        }

        folder_id = cap.folder_id;
        state = mox.calendar.checkOwnConfirmation(cap);

        var title = cap.title || _i18n("Untitled").toString(),
            location = cap.location || "",
            df = "datetime",
            endTS = cap.end_date;
        if (cap.full_time === true) {
            df = "date";
            endTS -= 86400000;
        }
        var start = formatDate(cap.start_date, df).toString(),
            end = formatDate(endTS, df).toString(),
            seriesInfoText = "",
            $seriesInfo = null,
            note = cap.note || "",
            locationstring = "";

        if (location !== "") {
            locationstring = format("Location: %s", location).toString();
        }
        $locationDiv = $("<div>").text(locationstring);
        $startDate = $("<div>").text(format(_i18n("Start: %s"), start).toString());
        $endDate =  $("<div>").text(format(_i18n("End: %s"), end).toString());

        $titleNode.text(title);
        if (state === "declined") {
            $titleNode.css("text-decoration", "line-through");

            // fix for bug 22172
            // force redraw of footer bar to apply new class
            if (isHybridApp) {
                $("#decline-appointment-button")
                    .addClass("ui-disabled").parent()
                    .css("position", "absolute");
                setTimeout(function() {
                    $("#decline-appointment-button").parent().css("position","fixed");
                }, 10);
            } else {
                $("#decline-appointment-button")
                    .addClass("ui-disabled");
            }

        } else if (state === "accepted") {
            // fix for bug 22172
            // force redraw of footer bar to apply new class
            if (isHybridApp) {
                $("#accept-appointment-button").addClass("ui-disabled")
                    .parent().css("position", "absolute");
                setTimeout(function() {
                    $("#accept-appointment-button").parent().css("position","fixed");
                }, 10);
            } else {
                $("#accept-appointment-button")
                    .addClass("ui-disabled");
            }
        }

        $locationNode.append($locationDiv).append($startDate).append($endDate);

        // if it's a series, get info string about it and append it
        if (seriesInfo !== null) {
            seriesInfoText = seriesInfo.getSeriesString().toString();

            //#. Indicates which type of appointment recurrence is actualy shown, i.e. "Every Week"
            $seriesInfo =$("<div>").text(format(_i18n("Recurrence: %s"), seriesInfoText).toString());
            $locationNode.append($seriesInfo);
        }

        $main.append($titleNode).append($locationNode);

        if (note !== "") {
            $textNode.text(note).css({
                "white-space": "pre-wrap",
                "word-wrap": "break-word"
            });
            $note.append($textNode);
        }

        // get particpants node
        $participantsNode = getParticipantsNode(cap);
        $participants.append($participantsNode);

        $('#app_main_editbutton').empty().append($('<a>')
            .attr({
                href: '#',
                'data-role': 'button'
            })
            .addClass('large')
            .text(_i18n("Edit").toString())
            .bind("tap", {cap: cap}, function(e) {
                e.preventDefault();
                if (!online) {
                    ui.showOfflineMessage();
                    return;
                }

                var action = function(ser) {
                    var startEdit = function(ap) {
                        appointmenteditor.editAppointment(ap, ser, function() {
                            $.mobile.changePage("#appointmentedit", { changeHash: false, transition : transitions.slideup });
                        });
                    };

                    // get series data for exception
                    if ((cap.recurrence_type === 0 && cap.recurrence_position > 0 && cap.id !== cap.recurrence_id) && ser === 2) {
                        mox.calendar.getAppointment(cap.recurrence_id, null, cap.folder_id, startEdit);
                    } else {
                        startEdit(cap);
                    }
                };

                // if series or exception
                if (
                    cap.recurrence_type > 0 || // series
                    (cap.recurrence_type === 0 && cap.recurrence_position > 0 && cap.id !== cap.recurrence_id) // exception
                ) {
                    // define buttons
                    var buttons = [{
                        text: _i18n("Edit whole recurrence").toString(),
                        secondary: true,
                        action: function() {
                            action(2);
                        }
                    },{
                        text: _i18n("Edit single appointment").toString(),
                        secondary: true,
                        action: function() {
                            action(1);
                        }
                    },  {
                        text: _i18n("Cancel").toString(),
                        primary: true,
                        action: $.noop
                    }];

                    // show overlay
                    ui.bottomSelectBox({
                        buttons: buttons,
                        method: "click" // tap can effect ghostcklicks
                    });
                } else {
                    action(0);
                }
            }).button()
        );

        refresh();
        if (typeOf(callback) === "function") {
            callback();
        }
    };

    // accept an appointment
    var accept = function() {
        /* pageloading */

        $(events).one("calendar-listview-refreshed", function() {
            showAppointment(app_id, recurrencePosition);
            ui.mail.updateCountBubbles();
            /* pageloading */
        });

        mox.calendar.confirmAppointment({ id: app_id, folder: folder_id }, 1, CONFIRM_MESSAGE, function() {
            mox.calendar.getUpdates();
        });
    };

    // deny appointment
    var deny = function() {
        /* pageloading */
        $(events).one("calendar-listview-refreshed", function() {
            showAppointment(app_id, recurrencePosition);
            ui.mail.updateCountBubbles();
            /* pageloading */
        });
        mox.calendar.confirmAppointment({ id: app_id, folder: folder_id }, 2, DECLINE_MESSAGE, function() {
            mox.calendar.getUpdates();
        });
    };

    var showNext = function() {
        var next = globalAppointmentListView.getNextApp(listPosition);
        if (next !== -1) {
            showAppointment(next.id, next.recPos);
        }
    };

    var showPrev = function() {
        if (listPosition > 0) {
            var prev = globalAppointmentListView.getPrevApp(listPosition);
            showAppointment(prev.id, prev.recPos);
        }
    };

    var validateCurrent = function () {
        // test if app_id with folder_id are still valid
        return !!mox.calendar.getAppointmentByID(app_id).id;
    };
    // public object
    var viewer = {
            showAppointment : function(id, rp, cb) {
                showAppointment(id, rp, cb);
            },
            getParticipantsNode: getParticipantsNode,
            getParsedData: function() {
                return ;
            },
            getRecurrencePosition: function() {
                return recurrencePosition;
            },
            accept: function() {
                accept();
            },
            deny: function() {
                deny();
            },
            refresh: function() {
                refresh();
            },
            showNext: function() {
                showNext();
            },
            showPrev: function() {
                showPrev();
            },
            clear: function() {
                clear();
            },
            validateCurrent: function () {
                return validateCurrent();
            }
    };
    return viewer;
};
/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */

/**
 * Class AppointmentEditor
 * @returns
 */

var AppointmentEditor = function() {
    var init = false,
        curAP = {},
        parti = [],
        partiIsChanged = false;

    var clearPage = function() {
        $("#appointment-edit-form")
            .empty();
    };

    var createList = function() {
        return $("<ul>")
            .attr({
                "data-role" : "listview",
                "data-inset" : "true"
            })
            .addClass('custom-list input-list');
    };

    var createListInputElement = function(label, name, value, showLabel, type) {
        var $clear = '';
        if (name == 'untilshow') {
            $clear = ui.getClearButton().bind("tap", function(e) {
                    e.preventDefault();
                    $('#apedituntilshow')
                        .val(_i18n('Never').toString());
                    $('#apedituntil').val('');
                });
        }
        return $('<li>')
            .append( $('<table>')
                .addClass('custom-list-table')
                .append($('<tr>')
                    .append(showLabel ? createLabel(label, name) : '')
                    .append($('<td>')
                        .append(createInputElement(showLabel ? '' : label, name, value, type))
                        .append($clear)
                    ))
            );
    };

    var createLabel = function(label, name) {
        return $('<td>')
            .addClass('custom-list-label nobackground')
            .append($('<label>')
                .attr({ "for" : name !== null ? name : '' })
                .text(label)
            );
    };

    var createInputElement = function(placeholder, name, value, type) {
        return $('<input/>')
            .attr({
                "type" : !type || type === 'date' ? 'text' : type,
                "name" : (type !== 'date' ? name : ''),
                "placeholder" : placeholder,
                "id" : "apedit" + name
            })
            .prop({
                "readonly" : (name === 'untilshow')
            })
            .addClass('custom-input ' + (type !== 'date' ? 'invisible' : 'center'))
            .val(value);
    };

    var createSelectElement =  function(values, id, name, placeholder, cap, isException) {

        var selected = cap[name],
            customRecurrence = false;
        isException = isException || false;

        // check Recurrence
        if (name === 'recurrence_type' && selected > 0) {
            var curDate = mox.calendar.getUTCDate(cap.start_date);

            if (
                cap.interval !== 1 ||
                (selected === 4 && cap.month != curDate.getMonth()) ||
                (selected === 3 && cap.day_in_month != curDate.getDate()) ||
                (selected === 2 && cap.days != Math.pow(2, curDate.getDay()))
            ) {
                delete(selected);
                var seriesInfo = new SeriesObject(cap, true);
                customRecurrence = _i18n('Custom').toString() + ': ' + seriesInfo.getSeriesString().toString();
                _.debug(1, customRecurrence);
            }
        }

        // check alarm
        if (name === 'alarm' && !selected) {
            selected = -1;
        }

        // build select
        var $sel = $('<select>').attr({
                name : name,
                id : id
            });

        var found = false;

        if (isException) {
             return $sel.append(
                $('<option>')
                    .val(selected)
                    .text(_i18n('Exception').toString())
                    .prop('selected', true)
            );
        }

        $.each(values, function(i, el) {
            var sel = false;
            if (selected !== undefined && selected === parseInt(i, 10)) {
                sel = true;
                found = true;
            }
            $sel.append(
                $('<option>')
                    .val(i)
                    .text(el)
                    .prop('selected', sel)
            );
        });
        // for unsupported alarm values
        if (name === 'alarm' && found === false && selected > 0) {
            $sel.append(
                $('<option>')
                    .val(selected)
                    .text(format(ngettext("%d minute", "%d minutes", selected), selected).toString())
                    .prop('selected', true)
            );
        }
        // for unsupported recurrence_type values
        if (name === 'recurrence_type' && customRecurrence !== false) {
            $sel.append(
                $('<option>')
                    .val('')
                    .text(customRecurrence)
                    .prop('selected', true)
            );
        }
        return $sel;
    };

    // delete participant from current appointment object
    var deleteParticipant = function(id) {
        returnArray = [];
        for (var i = 0; i < parti.length; i++) {
            if (parti[i].id !== id) {
                returnArray.push(parti[i]);
            }
        }
        // set global vars
        parti = returnArray;
        partiIsChanged = true;
        _.debug(1, 'deleteParticipant', id, parti);
    };

    var addParticipant = function(part) {
        parti.push(part);
        partiIsChanged = true;
        _.debug(1, 'addParticipant', part, parti);
        $('#partList')
            .append(getParticipantListElement(part, true))
            .listview('refresh');
    };

    // edit or create appointment
    var editAppointment = function(cap, ser, cb) {

        _.debug(1, 'editAppointment', cap, (ser > 1 ? 'Serie' : (ser === 1 ? 'Ausnahme' : 'Einzeltermin')) + ' bearbeiten');

        var _d = function(t, n) {
            switch (t) {
                case 'm':
                    return format(ngettext("%d minute", "%d minutes", n), n).toString();
                    break;
                case 'h':
                    return format(ngettext("%d hour", "%d hours", n), n).toString();
                    break;
                case 'd':
                    return format(ngettext("%d day", "%d days", n), n).toString();
                    break;
                case 'w':
                    return format(ngettext("%d week", "%d weeks", n), n).toString();
                    break;
                default:
                    return '';
                    break;
            }
        };

        var alarmTypes = {
            '-1' : _i18n("No reminder").toString(),
            '0' : _d('m', 0),
            '15' : _d('m', 15),
            '30' : _d('m', 30),
            '45' : _d('m', 45),
            '60' : _d('h', 1),
            '120' : _d('h', 2),
            '240' : _d('h', 4),
            '720' : _d('h', 12),
            '1440' : _d('d', 1),
            '2880' : _d('d', 2),
            '10080' : _d('w', 1)
        };

        var recurrenceTypes = {
            '0' : _i18n("No recurrence").toString(),
            '1' : _i18n("Daily").toString(),
            '2' : _i18n("Weekly").toString(),
            '3' : _i18n("Monthly").toString(),
            '4' : _i18n("Annually").toString()
        };

        var createMode = (cap === null),
            start, end,
            scrollerStart = null,
            scrollerEnd = null,
            scrollerUntil = null,
            isException = false,
            $partList = createList().attr('id', 'partList');

        // clean view
        clearPage();

        if (createMode) {
            // create folder select for new appointments
            var $folderSelect = $('<select>')
                .attr('name', 'folder_id');

            if (localUserConfig.folderTree.calendarFolders.length > 1) {
                $folderSelect
                    .append($('<option>').text(_i18n('Select folder').toString()).attr({
                        "data-placeholder" : "true",
                        "value" : ""
                    }));
            }
            $('#appointment-edit-form')
                .append($folderSelect);
            // build options
            $.each(localUserConfig.folderTree.calendarFolders, function(id, folder) {
                // check write permisson
                // folder[7] : rights
                var writable = util.getPermission(folder[7], 0).bit >= 2;

                // build option tag
                // folder[2] : Name
                if (writable) {
                    var $option = $('<option>')
                        .text(folder[2])
                        .prop('selected', folder[8])
                        .attr('value', folder[0]);
                    $folderSelect
                        .append($option);
                }
            });

            $('#contactsEditHeader')
                .text(_i18n('New contact').toString());

            start = mox.calendar.now();
            start += 900000 - (start%900000);
            end = start + 3600000; // add one hour
            cap = {
                end_date: end,
                start_date: start,
                full_time: false
            };
            parti = [];
            $('#appointmentEditHeader')
                .text(_i18n('New').toString());
        } else {
            start = cap.start_date;
            end = cap.end_date;
            cap.recurrence_type = cap.recurrence_type || 0;
            isException = (ser === 1);
            if (ser > 1 &&  cap.recurrence_position) {
                delete(cap.recurrence_position);
            }
            $('#appointmentEditHeader')
                .text(_i18n('Edit').toString());
        }

        // set global var
        curAP = cap;
        partiIsChanged = false;

        // show only date?
        var dateformat = cap.full_time ? 'date' : 'datetime';

        // main contact information
        $("#appointment-edit-form")
            .append(createList()
                .append(createListInputElement(_i18n('Title').toString(), 'title', cap.title, false))
                .append(createListInputElement(_i18n('Location').toString(), 'location', cap.location, false))
            )
            .append(createList()
                .append(createListInputElement(_i18n('Start').toString(), 'start_dateshow', formatDate(start, dateformat).toString(), true, 'date'))
                .append(createListInputElement(_i18n('End').toString(), 'end_dateshow', formatDate(cap.full_time ? (end - 86400000) : end, dateformat).toString(), true, 'date'))
            )
            .append('<input type="hidden" id="apeditstart_date" name="start_date" value="' + start + '"/>')
            .append('<input type="hidden" id="apeditend_date" name="end_date" value="' + end + '"/>')
            .append($('<label>')
                .attr('for', 'apeditfull_timeshow')
                .text(_i18n('Full-time').toString())
            )
            .append($('<input>')
                .attr({
                    type: 'checkbox',
                    id: 'apeditfull_timeshow'
                })
                .prop('checked', !!cap.full_time)
                .addClass('custom')
                .bind('change', function(e) {
                    e.preventDefault();
                    var checked = $(this).prop('checked'),
                        df = checked ? 'date' : 'datetime',
                        startTS = mox.calendar.getUTCTS(scrollerStart.scroller('getDate'), checked),
                        endTS = mox.calendar.getUTCTS(scrollerEnd.scroller('getDate'), checked);

                    $('#apeditfull_time').val(checked ? 1 : 0);
                    // change formatted time values
                    $('#apeditstart_dateshow').val(formatDate(startTS, df).toString());
                    $('#apeditend_dateshow').val(formatDate(endTS, df).toString());
                    if (checked) {
                        $('#apeditstart_date').val(startTS);
                        $('#apeditend_date').val(endTS + 86400000);
                    }

                    // change datepicker preset
                    scrollerStart.scroller('option', 'preset', df);
                    scrollerEnd.scroller('option', 'preset', df);
                })
            )
            .append($('<input>')
                .attr({
                    type : 'hidden',
                    id : 'apeditfull_time',
                    name : 'full_time'
                })
                .val(!!cap.full_time ? 1 : 0)
            )
            .append($('<label>')
                .attr('for', 'apeditnote')
                .text(_i18n('Info').toString())
            )
            .append($('<textarea>')
                .attr({
                    name: 'note',
                    id: 'apeditnote'
                })
                .val(cap.note)
            )
            .append('<br />')
            .append(createSelectElement(alarmTypes, 'apeditalarm', 'alarm', _i18n('Alarm').toString(), cap, false))
            .append(createList()
                .append($('<li>')
                    .css('border', '0px')
                    .append(
                        createSelectElement(recurrenceTypes, 'apeditrecurrence', 'recurrence_type', _i18n('Recurrence').toString(), cap, isException)
                            .bind('change', function() {
                                if ($(this).val() > 0) {
                                    $(this).closest('li').next().slideDown();
                                    $('#apedituntil').prop('disabled', false);
                                } else {
                                    $(this).closest('li').next().slideUp();
                                    $('#apedituntil').val('').prop('disabled', true);
                                    $('#apedituntilshow').val(_i18n('Never').toString());
                                }
                            })
                    )
                )
                .append(
                    createListInputElement(_i18n('End').toString(), 'untilshow', cap.until ? formatDate(cap.until, 'date').toString() : _i18n('Never').toString(), true, 'date')
                        .addClass((cap.recurrence_type > 0) ? '' : 'ui-screen-hidden')
                )
            )
            .append($('<input>')
                .attr({
                    type : 'hidden',
                    id : 'apedituntil',
                    name : 'until'
                })
                .val(cap.until ? cap.until : '')
                .prop('disabled', !cap.until || isException)
            )
            .append($('<input>')
                .attr({
                    type : 'hidden',
                    id : 'apeditrecurrence_position',
                    name : 'recurrence_position'
                })
                .val(cap.recurrence_position ? cap.recurrence_position : '')
                .prop('disabled', !isException)
            )
            .append($('<label for="partList">').text(_i18n("Participants:").toString()))
            .append($partList
                .removeClass('input-list')
                .append($('<li>')
                    .css('padding', 0)
                    .append($('<table>')
                        .addClass('custom-list-table')
                        .append($('<tr>')
                            .append($('<td>')
                                .css('width', '100%')
                                .append($('<input>')
                                    .attr({
                                        type : 'email',
                                        placeholder : _i18n("E-Mail").toString(),
                                        name : 'ignore'
                                    })
                                    .bind('blur keyup', function(e) {
                                        e.preventDefault();
                                        // event.which is not realiable here as
                                        // android 2.3 does trigger 0 on some special chars as keycode
                                        // like the @ sign or #. Happens also in Chrome after releasing the
                                        // alt gr key
                                        if (e.which !== undefined && (e.which != 13 || e.which == 0)) {
                                            return false; // don't add address, user ist still typing
                                        }
                                        var addr = $(this).val();
                                        if (addr !== '') {
                                            $(this).val('');
                                            addParticipant({
                                                type : 5,
                                                mail : addr
                                            });
                                        }

                                    })
                                )
                            )
                            .append($('<td>')
                                .append($('<div>')
                                    .addClass('addcontact-icon')
                                    .attr('id', 'addParticipant')
                                    .bind('click', function(e) {
                                        e.preventDefault();
                                        globalContactListViews.all.setSelectMode(true);
                                        globalContactListViews.all.setSelectMetaData({ contactSelect: "participant" });
                                        $.mobile.changePage("#contacts", {transition: transitions.slideup, changeHash: true});
                                        globalContactListViews.all.setLastPage("#appointmentedit");
                                    })
                                )
                            )
                        )
                    )
                )
            );

        if (mox.contextData.users !== undefined && cap.participants) {
            parti = cap.participants;

            // loop through all participants
            for (var i = 0; i < parti.length; i++) {
                $partList
                    .append(getParticipantListElement(parti[i]));
            }
        }

        // convert dateformat from default to mobiscroll
        var dateConv = function(date, type) {
            var retval = '';
            if (type === 'date') {
                retval = date.replace('yyyy', 'yy');
                retval = retval.replace('MM', 'mm');
            }
            if (type === 'time') {
                retval = date.replace('mm', 'ii');
                retval = retval.replace('a', 'A');
            }
            return retval;
        };

        // set default values for mobiscroll plugin
        var scollerDF = dateConv(_i18n('yyyy-MM-dd').toString(), 'date'),
            scollerTF = dateConv(_i18n('HH:mm').toString(), 'time'),
            scollerDefaults = {
                mode : _.browser.IE ? 'clickpick' : 'scroller',
                theme: 'jqm',
                stepMinute: 5,
                dateFormat: scollerDF,
                dateOrder: scollerDF.replace(/[^a-zA-Z ]+/g,''),
                timeFormat: scollerTF,
                timeWheels: scollerTF.replace(/[^a-zA-Z ]+/g,''),
                cancelText: _i18n('Cancel').toString(),
                setText: _i18n('OK').toString(),
                secText: _i18n('Second').toString(),
                minuteText: _i18n('Minute').toString(),
                hourText: _i18n('Hour').toString(),
                dayText: _i18n('Day').toString(),
                monthText: _i18n('Month').toString(),
                yearText: _i18n('Year').toString(),
                dayNames: [
                    _i18n('Sunday').toString(),
                    _i18n('Monday').toString(),
                    _i18n('Tuesday').toString(),
                    _i18n('Wednesday').toString(),
                    _i18n('Thursday').toString(),
                    _i18n('Friday').toString(),
                    _i18n('Saturday').toString()
                ],
                monthNames: [
                    _i18n('January').toString(),
                    _i18n('February').toString(),
                    _i18n('March').toString(),
                    _i18n('April').toString(),
                    _i18n('May').toString(),
                    _i18n('June').toString(),
                    _i18n('July').toString(),
                    _i18n('August').toString(),
                    _i18n('September').toString(),
                    _i18n('October').toString(),
                    _i18n('November').toString(),
                    _i18n('December').toString()
                ],
                monthNamesShort: [
                    _i18n('Jan').toString(),
                    _i18n('Feb').toString(),
                    _i18n('Mar').toString(),
                    _i18n('Apr').toString(),
                    _i18n('May').toString(),
                    _i18n('Jun').toString(),
                    _i18n('Jul').toString(),
                    _i18n('Aug').toString(),
                    _i18n('Sep').toString(),
                    _i18n('Oct').toString(),
                    _i18n('Nov').toString(),
                    _i18n('Dec').toString()
                ]
            };

        // init scoller for end_date
        scrollerEnd = $('#apeditend_dateshow')
            .scroller(scollerDefaults)
            .scroller('option', {
                preset: dateformat,
                minDate: mox.calendar.getUTCDate(start),
                onSelect : function(d, s) {
                    var ts = mox.calendar.getUTCTS($(this).scroller('getDate'));
                    if ($('#apeditfull_timeshow').prop('checked')) {
                        ts += 86400000;
                    }
                    $('#apeditend_date').val(ts);
                }
            });

        // init scoller for until
        scrollerUntil = $('#apedituntilshow')
            .scroller(scollerDefaults)
            .scroller('option', {
                preset: 'date',
                disabled: isException,
                minDate: mox.calendar.getUTCDate(start),
                onSelect : function(d, s) {
                    $('#apedituntil')
                        .val(mox.calendar.getUTCTS($(this).scroller('getDate')))
                        .prop('disabled', false);
                }
            });

        // init scoller for start_date
        scrollerStart = $('#apeditstart_dateshow')
            .scroller(scollerDefaults)
            .scroller('option', {
                preset: dateformat,
                onSelect : function(d, s) {
                    // get values from all scrollers
                    var startDate = $(this).scroller('getDate'),
                        startDateTS = mox.calendar.getUTCTS(startDate),
                        endDate = scrollerEnd.scroller('getDate'),
                        untilDate = scrollerUntil.scroller('getDate');

                    // set formvalue (timestamp) for startDate
                    $('#apeditstart_date').val(startDateTS);

                    // set minDate option to the other scrollers
                    scrollerEnd.scroller('option', {
                        minDate: startDate
                    });
                    scrollerUntil.scroller('option', {
                        minDate: startDate
                    });

                    // if scollervalues smaller than startdate, then correct scroller- and formvalues
                    if (endDate.getTime() < startDate.getTime()) {
                        scrollerEnd.scroller('setDate', startDate, true);
                        $('#apeditend_date').val(startDateTS);
                    }
                    if (untilDate.getTime() < startDate.getTime()) {
                        _.debug(1, untilDate.getTime());
                        if ($('#apedituntil').val() !== '') {
                            scrollerUntil.scroller('setDate', startDate, true);
                            $('#apedituntil').val(startDateTS);
                        }
                    }
                }
            });

        // add delete button
        if (!createMode) {
            // check delete rights
            var permisson = util.getPermission(mox.calendar.getFolder(cap.folder_id)[7], 21).bit;
            if(permisson >= 2 || (permisson == 1 && cap.created_by == userID)) {
                var $delButton = $("<a>")
                    .attr({
                        href: "#",
                        "data-role": "button",
                        "data-theme": "a",
                        "class": "custom-standard-button custom-button-popup delete large",
                        "id": "deletecontactbutton"
                    })
                    .text(_i18n("Delete").toString())
                    .bind("tap", function(e) {
                        e.preventDefault();
                        var buttons = [{
                            text: _i18n("Delete appointment").toString(),
                            delbutton: true,
                            action: function() {
                                mox.calendar.deleteAppointment(cap, function() {
                                    mox.calendar.getUpdates(function() {
                                        window.history.pushState({foo: "bar"}, 'wurstpeter', '#calendar');
                                        $.mobile.changePage("#calendar", { transition : transitions.slidedown });
                                    });
                                });
                            }
                        }, {
                            text: _i18n("Cancel").toString(),
                            secondary: true,
                            action: $.noop
                        }];

                        // show overlay
                        ui.bottomSelectBox({
                            buttons: buttons,
                            method: "click" // tap can effect ghostcklicks
                        });
                    });
                $("#appointment-edit-form")
                    .append($delButton);
            }
        }

        // jqm mobile stuff
        // we can only trigger the create on the list if
        // it was not inited by the page before.
        // This usally happens on the first time the contact detail page
        // is visited. After this we need to trigger the listview() by
        // ourselfs
        if (init) {
            $('#appointment-edit-form ul').listview();
            $('#appointment-edit-form select').selectmenu();
            $('#appointment-edit-form a').button();
            $('#appointment-edit-form input[type="email"]').textinput();
            $('#appointment-edit-form input[type="checkbox"]').checkboxradio();
        } else {
            init = true;
        }

        // focus first inputfield
        setTimeout(function() {
            $(':text, textarea, input[type="date"], input[type="time"]', '#appointment-edit-form ')
                .textinput()
                .first()
                .focus();
        }, 0);

        // callback
        if (typeof(cb) === 'function') {
            cb();
        }
    };

    $(events).bind("contact_selected", function(e, f) {
        if (!f.meta.contactSelect || f.meta.contactSelect !== 'participant') {
            return;
        }

        var contact = f.fullDataSet;

        _.debug(1, 'contact_selected participant', contact);

        // check for distribution list
        if (contact.distribution_list !== null) {
            // not supported TODO: warning
            return;
        }

        if (contact.internal_userid !== null) {
            // internal
            addParticipant({
                display_name: f.text,
                id: contact.internal_userid,
                type: 1
            });
            globalContactListViews.all.setSelectMode(false);
            $.mobile.changePage("#appointmentedit", {transition: transitions.slideup, reverse: true, changeHash: false});
        } else {
            // external
            var email = [],
                displayName = contact.display_name;

            // get mailadress
            if (contact.email1) {
                email.push(contact.email1);
            }
            if (contact.email2) {
                email.push(contact.email2);
            }
            if (contact.email3) {
                email.push(contact.email3);
            }
            if (email.length === 1) {
                addParticipant({
                    display_name: displayName,
                    mail: email[0],
                    type: 5
                });
                globalContactListViews.all.setSelectMode(false);
                $.mobile.changePage("#appointmentedit", {transition: transitions.slideup, reverse: true, changeHash: false});
            } else if (email.length > 1) {
                contactviewer.drawMailChoose(f.id, function() {
                    $.mobile.changePage("#contactdetail", {transition: transitions.slide, changeHash: false});
                }, function(email, text) {
                    addParticipant({
                        display_name: text,
                        mail: email,
                        type: 5
                    });
                    globalContactListViews.all.setSelectMode(false);
                    $.mobile.changePage("#appointmentedit", {transition: transitions.slideup, reverse: true, changeHash: false});
                });
            }
        }
    });

    var getParticipantListElement = function(elem, addMode) {
        var text = '',
            sign = '',
            csscls = '',
            status = 0,
            $part = $("<li>"),
            $partDel = $('<div>');
        addMode = addMode || false;

        // external participant ?
        if (!addMode) {
            if (elem.type === 5) {
                status = mox.calendar.checkConfirmation(elem, curAP.confirmations );
            } else {
                status = mox.calendar.checkConfirmation(elem, curAP.users);
            }
        }

        switch (elem.type) {
            case 1: // internal
                if (!addMode && mox.contextData.users[elem.id] && mox.contextData.users[elem.id][1]) {
                    text = mox.contextData.users[elem.id][1];
                } else {
                    text = elem.display_name;
                }
                // different states for internal users
                switch (status) {
                    case 0:
                        // no status
                        csscls = 'nostatuscolor';
                        sign = 'no-icon';
                        break;
                    case 1:
                        // utf-8 check mark sign for accepted participants
                         csscls = 'acceptcolor';
                        sign = 'accepted';
                        break;
                    case 2:
                        // utf-8 cross for denied participants
                        csscls = 'deniedcolor';
                        sign = 'denied';
                        break;
                    case 3:
                        csscls = 'tentativecolor';
                        sign = 'no-icon';
                        break;

                    default:
                        break;
                }
                $part.append($partDel);
                break;
            case 2: // groups
                text = mox.contextData.groups[elem.id].display_name;
                csscls = 'nostatuscolor';
                sign = 'group';
                break;
            case 3: // resource
                text = mox.contextData.resources[elem.id].display_name;
                csscls = 'nostatuscolor';
                sign = 'resource';
                break;
            case 5: // extrenal
                text = (elem.display_name && elem.display_name !== elem.mail) ? elem.display_name + ", " + elem.mail : elem.mail;
                csscls = 'nostatuscolor';
                sign = 'external';
                $part.append($partDel);
            case 4: // resource group - no handling
                break;
            default:
                break;
        }

        $part
            .addClass("calendar participants " + csscls)
            //.append($('<span class="spanwidth">' + sign + '</span>&nbsp;'))
            .append($('<div class="calendar-icon '+ sign +'"></div>'))
            .append($("<span>").addClass("calendarspacer").text(text));

        $partDel
            .addClass('calendar participantsdelete custom-button-popup delete ui-corner-all')
            .text(_i18n("Remove").toString())
            .bind('tap', {el : elem, part: $part}, function(e) {
                e.preventDefault();
                var id = e.data.el.id,
                    part = e.data.part;

                ui.showAlertBox(_i18n("Permanently delete participant?").toString(), {
                    buttons: [{
                        text: _i18n("Cancel").toString(),
                        action: $.noop
                    }, {
                        text: _i18n("Delete").toString(),
                        action: function() {
                            deleteParticipant(id);
                            part.slideUp('fast', function() {
                                $(this).remove();
                            });
                        },
                        delbutton: true
                    }]
                });
            });
        return $part;
    };

    var getFormData = function() {
        // placeholder fix for IE
        $('#appointment-edit-form')
            .val(function(i, val) {
                return (val === $(this).attr('placeholder')) ? '' : val;
            });

        var formData = $('#appointment-edit-form').serializeArray(),
            diff = {},
            count = 0,
            editSeries = false;

        $.each(formData, function(i, e) {
            e.value = e.value === "" ? null : e.value;
            switch (e.name) {
                case 'full_time':
                    diff[e.name] = (e.value === '1');
                    if (curAP[e.name] != (e.value === '1')) {
                        count++;
                    }
                    break;
                case 'start_date':
                case 'end_date':
                    diff[e.name] = parseInt(e.value, 10);
                    if (curAP[e.name] !== diff[e.name]) {
                        count++;
                    }
                    break;
                case 'alarm':
                    if (curAP[e.name] === null || curAP[e.name] === undefined) {
                        curAP[e.name] = -1;
                    }
                    if ((e.value !== null) && (curAP[e.name] != parseInt(e.value, 10))) {
                        count++;
                        diff[e.name] = parseInt(e.value, 10);
                    }
                    break;
                case 'until':
                    diff[e.name] = parseInt(e.value, 10);
                    if (curAP[e.name] !== diff[e.name]) {
                        count++;
                    }
                    break;
                case 'recurrence_position':
                    diff[e.name] = parseInt(e.value, 10);
                    break;
                case 'recurrence_type':
                    var recType = parseInt(e.value, 10);
                    if (curAP[e.name] === null || curAP[e.name] === undefined) {
                        curAP[e.name] = 0;
                    }
                    diff[e.name] = recType;
                    if (recType > 0) {
                        var curDate = mox.calendar.getUTCDate(curAP.start_date);
                        if (curAP.interval != 1) {
                            count++;
                        }
                        diff.interval = 1;

                        switch (recType) {
                        case 4:
                            diff.month = curDate.getMonth();
                            if (curAP.month != curDate.getMonth()) {
                                count++;
                            }
                            /* falls through */
                        case 3:
                            diff.day_in_month = curDate.getDate();
                            if (curAP.day_in_month != curDate.getDate()) {
                                count++;
                            }
                            break;
                        case 2:
                            diff.days = Math.pow(2, curDate.getDay());
                            if (curAP.days != curDate.getDay()) {
                                count++;
                            }
                            break;
                        default:
                            break;
                        }
                    }
                    if ((e.value !== null) && (curAP[e.name] != parseInt(e.value, 10))) {
                        count++;
                        editSeries = true;
                    }
                    break;
                case 'ignore':
                    break;
                case 'folder_id':
                    if (e.value !== null) {
                        diff[e.name] = e.value;
                    }
                    break;
                default:
                    if (curAP[e.name] != e.value) {
                        count++;
                        diff[e.name] = e.value;
                    }
                    break;
            }
        });

        // check paticipants
        if (partiIsChanged) {
            diff.participants = parti;
            count++;
        }

        // set notification
        diff.notification = mox.calendar.options.notify;

        _.debug(1, 'getFormData', curAP, diff, count, editSeries);
        return {
            diff : diff,
            changed : (count > 0),
            editSeries : editSeries
        };
    };

    var loadScroller = function(cb) {
        _.debug('loadScroller libs', cb);
        Modernizr.load({
            test: $.scroller,
            nope: ['lib/jqm/mobiscroll.min.css', 'lib/jqm/mobiscroll.min.js'],
            complete : function () {
                _.debug('loadScroller libs success');
                // set theme defaults for mobiscroll plugin
                (function ($) {
                    $.scroller.themes.jqm = {
                        defaults: {
                            jqmBody: 'c',
                            jqmHeader:'a',
                            jqmWheel: 'c',
                            jqmClickPick: 'c',
                            jqmSet: 'c',
                            jqmCancel: 'c'
                        },
                        init: function(elm, inst) {
                            var s = inst.settings;
                            $('.dw', elm).removeClass('dwbg').addClass('ui-overlay-shadow ui-corner-all ui-body-a');
                            $('.dwb-s a', elm).attr('data-role', 'button').attr('data-theme', s.jqmSet);
                            $('.dwb-c a', elm).attr('data-role', 'button').attr('data-theme', s.jqmCancel);
                            $('.dwwb', elm).attr('data-role', 'button').attr('data-theme', s.jqmClickPick);
                            $('.dwv', elm).addClass('ui-header ui-bar-' + s.jqmHeader);
                            $('.dwwr', elm).addClass('ui-body-' + s.jqmBody);
                            $('.dwpm .dww', elm).addClass('ui-body-' + s.jqmWheel);
                            if (s.display != 'inline') {
                                $('.dw', elm).addClass('pop in');
                            }
                            elm.trigger('create');
                            // Hide on overlay click
                            $('.dwo', elm).click(function() { inst.hide(); });
                        }
                    };
                })(jQuery);
                // callback
                if (typeof(cb) === 'function') {
                    cb();
                }
            }
        });

    };

    var appointmenteditor = {
        editAppointment: function(cap, ser, cb) {
            loadScroller(function() {
                editAppointment(cap, ser, cb);
            });
        },
        newAppointment: function(cb) {
            loadScroller(function() {
                editAppointment(null, null, cb);
            });
        },
        getFormData: function() {
            return getFormData();
        },
        getCurrentAppointment: function() {
            return curAP;
        }
    };
    return appointmenteditor;
};

var appointmenteditor = new AppointmentEditor();
/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

//namespace for module calendar
mox.calendar = {
    appointmentLists: { },
    fields : {
        "1"   : "id",
        "2"   : "created_by",
        "3"   : "modified_by",
        "4"   : "creation_date",
        "6"   : "last_modified", // last_modified_utc
        "20"  : "folder_id",
        "200" : "title",
        "201" : "start_date",
        "202" : "end_date",
        "203" : "note",
        "204" : "alarm",
        "206" : "recurrence_id",
        "207" : "recurrence_position",
        "208" : "recurrence_date_position",
        "209" : "recurrence_type",
        "210" : "change_exceptions",
        "211" : "delete_exceptions",
        "212" : "days",
        "213" : "day_in_month",
        "214" : "month",
        "215" : "interval",
        "216" : "until",
        "220" : "participants",
        "221" : "users",
        "226" : "confirmations",
        "400" : "location",
        "401" : "full_time",
        "402" : "shown_as"
    },
    getColumns: "1,2,3,4,6,20,200,201,202,400,220,221,401,203,209,207,208,210,211,212,213,214,215,216,226,204,206",
    newAppointments: [],
    options: {
        notify: true
    }
};

var globalAppointmentListView;

mox.calendar.getColumnsList = mox.calendar.getColumns.split(",");

/**
 * get calendar folder
 * @param id String
 * @returns Array folder else false
 */
mox.calendar.getFolder = function(id) {
    var folders = localUserConfig.folderTree.calendarFolders;
    for (var i=0; i < folders.length; i++) {
        if (folders[i][0] === id.toString()) {
            return folders[i];
        }
    }
    return false;
};

mox.calendar.getObjectFromData = function (data) {
    var ob = {};
    var getColumns = mox.calendar.getColumns.split(',');
    for (var  i = 0; i < data.length; i++) {
        if (i === 27) {
            ob.showOnDay = data[i];
            break;
        };
        ob[mox.calendar.resolveField(getColumns[i])] = data[i];

    }
    if (data.length < 28) {
        ob.showOnDay = ob.start_date;
    }
    return ob;
}

/**
 * resolve a field to cleartext or reverse
 * @param field String, either a number or a text
 * @example "200" <--> "title"
 */
mox.calendar.resolveField = function(field) {
  var result = null;
  if (field.match(/[0-9]/)) {
      result = mox.calendar.fields[field];
  } else {
      $.each(mox.calendar.fields, function(i, e) {
          if (e === field) {
              result = i;
          }
      });
  }
  return result;
};

/**
 * getTime with server offset
 */
mox.calendar.now = function() {
    now = function() { return (new Date()).getTime() + now.offset; };
    now.offset = mox.calendar.now.offset;
    return now();
};

/**
 * getDate with server offset
 */
mox.calendar.getUTCDate = function(ts) {
    tmp = new Date(ts);
    return new Date(
        tmp.getUTCFullYear(),
        tmp.getUTCMonth(),
        tmp.getUTCDate(),
        tmp.getUTCHours(),
        tmp.getUTCMinutes(),
        tmp.getUTCSeconds()
    );
};

/**
 * get timestamp from js DATE without server offset
 */
mox.calendar.getUTCTS = function(date, dateOnly) {
    dO = dateOnly || false;
    return Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        dO ? 0 : date.getHours(),
        dO ? 0 : date.getMinutes(),
        dO ? 0 : date.getSeconds()
    );
};

/**
 * confirm an appointment
 * @param app
 * @param confirmation
 * @param message
 * @param callback
 */
mox.calendar.confirmAppointment = function(app, confirmation, message, callback) {
    _.debug("confirm appointment", app, confirmation, message, callback);
    var responseObject = {
        "confirmation": confirmation,
        "confirmmessage": message
    };

    var success = function(e){
        if (e.error) {
            mox.error.handleError(e);
        }
        if (typeof(callback) === "function") {
            callback(e);
        }
    };

    $.ajax({
        url: HOST + "/calendar?action=confirm&session=" + session + "&id=" + app.id + "&folder=" + app.folder,
        data: JSON.stringify(responseObject),
        success: success,
        error: errorHandler,
        type: "PUT",
        dataType: "json",
        contentType: "text/javascript"
    });
};
/**
 * getDaysForAppointment
 * calculates a list of single day occurences for a
 * multiday appointment. This is used to draw multiple
 * rows for a single appointment in the calendar list view
 */
mox.calendar.getDaysForAppointment = function (app) {

    var cue = [],
        theapp = mox.calendar.getObjectFromData(app),
        start = new Date(theapp.start_date),
        end = new Date(theapp.end_date),
        displayDays = []; // number of days an appointment must be displayed
    if (!util.date.equalsDay(start, end)) {
        // its a multiday app
        var durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        // we have to show this appointment on durationsDays -1 days
        // the original date  and the following days

        for (var k = 1 ; k < durationDays; k++) {
            // for each day we create a new list entry
            var date = new Date(start.getTime());
            date.setUTCDate(date.getUTCDate() + k); // one day more
            date.setUTCHours(0, 0, 0, 0);
            var temp = app.slice(0); // do shallow copy
            var timestamp = date.getTime();
            // push timestamp to elem array
            temp.push(timestamp);
            // add complete elem to cue
            cue.push(temp);
        }
    }
    return cue;
}

/**
 * get all updated appointments
 * @param cb Function callback
 */
mox.calendar.getUpdates = function(cb) {
    _.debug("calendar.getUpdates", cb);

    var count = localUserConfig.appointmentDays,
        columns = mox.calendar.getColumns,
        url = HOST + "/multiple?continue=true&session=" + session,
        requestBody = [],
        timeStamp = thisDay(mox.calendar.now.offset).getTime(),
        nextTimeStamp = timeStamp + count * 86400000;

    // build request body
    for (var f = 0; f < localUserConfig.folderTree.calendarFolders.length; f++ ) {
        requestBody.push({
            "module"    : "calendar",
            "action"    : "updates",
            "columns"   : columns,
            "start"     : timeStamp,
            "end"       : nextTimeStamp,
            "timestamp" : mox.calendar.lastUpdate,
            "folder"    : localUserConfig.folderTree.calendarFolders[f][0],
            "ignore"    : "deleted"
        });
    }

    var participantFinder = function (app, currentList) {

        var list = {
            users       : [],
            groups      : [],
            resources   : []
        };
        // TODO replace $.each with for loop
        // look for new participants in this appointment
        $.each(app[10], function(l, elem2) {
            if( elem2.id !== undefined ) {
                switch (elem2.type) {
                    case 1:
                        // found a user, add to resolve list if not already done
                        if (!mox.contextData.users[elem2.id] && !currentList.users[elem2.id]) {
                            _.debug("found new user", elem2.id);
                            list.users.push(elem2.id);
                        }
                        break;
                    case 2:
                        // found new group in appointment
                        if (!mox.contextData.groups[elem2.id] && !currentList.groups[elem2.id]) {
                            _.debug("found new group", elem2.id);
                            list.groups.push({id: elem2.id});
                        }
                        break;
                    case 3:
                        // found new resource in appointment
                        if (!mox.contextData.resources[elem2.id] && !currentList.resources[elem2.id]) {
                            _.debug("found new resource", elem2.id);
                            list.resources.push({id: elem2.id});
                        }
                        break;
                    case 4:
                        // no handling for resource groups
                        break;
                }
            }
        });
        return {
           users     : _.union(list.users, currentList.users),
           groups    : _.union(list.groups, currentList.groups),
           resources : _.union(list.resources, currentList.resources)
        };
    };

    /**
     * successhandler does a very weird check for updates and new appointments. It
     * might be confusing because the listviews handel multi-day appointment
     * (appointment with duration > one day) like single appointments. Also we have
     * to ensure not to display entries which are in the past.
     * Example: Appointment duration is 4 days, we are on the 3rd day. So the list
     * does not display the "master" entry of the appointment, only
     * the calculated "rest" of the appointment. In this case 2 days, today and tomorrow
     */
    var success = function (response) {
        _.debug(3, "calendar.getUpdates.success", response);
        if (response.error) {
            mox.error.handleError(response);
        } else {
            var listToUpdate = mox.calendar.appointmentLists.all.data,
                newParticipants = {users : [], groups : [], resources : []};
            // one loop for each calendar folder
            for (var i = 0; i < response.length; i++) {
                if (response[i].timestamp > mox.calendar.lastUpdate) {
                    mox.calendar.lastUpdate = response[i].timestamp;
                }

                // errorhandling
                if (response[i].error) {
                    mox.error.handleError(response[i]);
                } else {
                    var list = response[i].data;
                    // loop through updated/changed/deleted appointments
                    for (var j = 0; j < list.length; j++) {

                        var newAppointment = true, app = list[j];
                        // changed or new

                        // look through list
                        for (var k = 0; k < listToUpdate.length; k++) {
                            var oldApp = listToUpdate[k];

                            // plain update of single appointment
                            // same id and same recurrence position
                            if ( oldApp[0] === app[0] && oldApp[15] === app[15]) {
                                newAppointment = false;

                                var cue = mox.calendar.getDaysForAppointment(app);

                                // replace global appointment item with new one for detail view
                                listToUpdate[k] = app;
                                // update listview, too
                                globalAppointmentListView.deleteItem(app[0], app[26]);

                                if (app[7] >= timeStamp) {
                                    globalAppointmentListView.addRow(app); // original one, display only if not in the past
                                }
                                if (cue.length > 0 ) {
                                    // maybe has become multiday appointment

                                    for (var i = 0; i < cue.length; i++) {
                                        if (cue[i][27] >= timeStamp) {

                                            globalAppointmentListView.addRow(cue[i]);
                                        }
                                    }
                                }
                                newParticipants = participantFinder(app, newParticipants);
                            }
                        }
                        // handle new appointments
                        if (newAppointment) {
                            newParticipants = participantFinder(app, newParticipants);
                            listToUpdate.push(app);

                            var cue = mox.calendar.getDaysForAppointment(app);

                            // onl< display the "master" appointment if it's not in the past
                            if (app[7] >= timeStamp) {
                                globalAppointmentListView.addRow(app);
                            }

                            // add cue if needed, the remeaining days of a multi day appointment
                            for (var i = 0; i < cue.length; i++) {
                                // only for days which are not in the past
                                if (cue[i][27] >= timeStamp) {
                                    globalAppointmentListView.addRow(cue[i]);
                                }
                            }
                        }
                    }
                    _.debug(3,"new participants", newParticipants);
                }
            }
            _.debug(3, "got new participants to lookup:", newParticipants);

            mox.calendar.resolveParticipants(newParticipants, function() {
                // we need to do an all to get all deleted appointments
                $.ajax({
                    url: url,
                    success: function (resp) {
                        _.debug("calendar.getAll after update.success", resp);
                        // errorhandling
                        if (resp[0].error) {
                            mox.error.handleError(resp[0]);
                        } else {
                            var listToUpdate = mox.calendar.appointmentLists.all.data,
                                serverdata = resp[0].data, temp = [];
                            if (serverdata.length < listToUpdate.length) {
                                temp = _.clone(listToUpdate);
                                for (var i = 0; i < listToUpdate.length; i++) {
                                    for (var j = 0; j < serverdata.length; j++) {
                                        if (listToUpdate[i][0] === serverdata[j][0] && listToUpdate[i][15] === serverdata[j][2]) {
                                            // this is equal in both lists
                                            delete(temp[i]);
                                        }
                                    }
                                }
                            }

                            var deletedAppointments = _.compact(temp);
                            _.debug("deleted Appointments", deletedAppointments);
                            for (var k = 0; k < deletedAppointments.length; k++) {
                                // delete app from list and storage
                                mox.calendar.deleteAppointmentByID(deletedAppointments[k][0], deletedAppointments[k][15]);
                                globalAppointmentListView.deleteItem(deletedAppointments[k][0], deletedAppointments[k][15]);
                            }
                            $(events).trigger("calendar-update-ready");
                            // callback
                            if (typeof(cb) === 'function') {
                                cb();
                            }
                        }
                    },
                    error: errorHandler,
                    data: JSON.stringify([{
                        "module" : "calendar",
                        "action" : "all",
                        "columns": "1,20,207",
                        "sort"   : "201",
                        "start"  : timeStamp,
                        "end"    : nextTimeStamp
                    }]),
                    dataType: "json",
                    type: "put",
                    processData: false
                });
            });
        }
    };
    // first ajax call
    $.ajax({
        url: url,
        success: success,
        error: errorHandler,
        data: JSON.stringify(requestBody),
        dataType: "json",
        type: "put",
        processData: false
    });
};

/**
 * get a list of appointments
 * @param count days to fetch appointments
 * @param callback
 */
mox.calendar.getAppointmentList = function(count, callback) {
    _.debug("calendar.getAppointmentList", count, callback);

    mox.calendar.newAppointments = [];
    globalAppointmentListView = new AppointmentListView();

    var timeStamp = thisDay(mox.calendar.now.offset).getTime(), // now with offset
        nextTimeStamp = timeStamp + count * 86400000;

    var columns = mox.calendar.getColumns,
        url = HOST + "/multiple?continue=true&session=" + session,
        requestBody = [];

    // get all appointments from all folders
    requestBody.push({
        "module"    : "calendar",
        "action"    : "all",
        "columns"   : columns,
        "sort"      : 201,
        "start"     : timeStamp,
        "end"       : nextTimeStamp
    });

    var success = function(appointments) {

        if (appointments.error) {
           mox.error.handleError(appointments);
        } else {

            // remember last update
            mox.calendar.lastUpdate = appointments[0].timestamp;

            // will be filled and resolved
            var resolvelist = {
                    users: [],
                    groups: [],
                    resources: []
            };

            // only one calendar at the moment
            mox.calendar.appointmentLists.all = appointments[0];
            // save in localstorage
            if (storage.getMode !== 0) {
                storage.setItem("appointments", mox.calendar.appointmentLists.all, true);
            }

            var obj = appointments[0].data;

            // nothing to show? stop here!
            if ( obj.length === 0 ) {
                globalAppointmentListView.showEmptyMessage();
                return;
            }

            // we have to create a new list with all appointments
            // which do have multi day duration
            // for each day the appointment "reappears", we will add a new list item
            var cue = [], list = obj.slice(0); // shallow copy

            // loop over orignal list
            for (var j = 0; j < obj.length; j++) {
                cue = cue.concat(mox.calendar.getDaysForAppointment(obj[j]));
            }

            // sort the cue by show date
            cue.sort(function(a, b) {
                return a[27] - b[27];
            });

             //loop over the cue, sort the entries in a copy of the original list
            for (var k = 0, length = cue.length; k < length; k++) {

                var cueElem = cue[k];
                //look trough cue and place them in obj list
                for (var i = 0; i < obj.length; i++) {
                    var listElem = obj[i];
                    // there is a element following?
                    if (i !== obj.length - 1) {
                        // find place to sort in
                        if ((cueElem[27] > listElem[7]) && (cueElem[27] < obj[i+1][7])) {
                            // nice function to place an element in an array
                            list.splice(k, 0, cueElem);
                            break; //stop here
                        }
                    } else {
                        // it's the end of the list as we know it.. whohoho
                        // TODO insert complete song lyrics here
                        list.splice(k, 0, cueElem);
                    }
                }
            }

            // for each entry in the new list
            for (var l = 0; l < list.length; l++) {
                if (!list[l][27]) {
                    list[l][27] = list[l][7]; // make start date the showDate for all "normal" appointments
                }
            };

            // sort it by "showdate"
            list.sort(function(a,b) {
                return a[27] - b[27]
            });

            // loop over the faked appointmentlist.
            // this is not a 1 to 1 relationship, single appointments can occur n times in this list
            $.each(list, function(k, elem) {

                // add a row in listview for each elem that must be displayed (multi day appointments
                // starting in the past may only occur on some days)

                if (elem[27] >= timeStamp) {
                    globalAppointmentListView.addRow(elem);
                    // loop through participants
                    $.each(elem[10], function(l, elem2) {

                        if( elem2.id !== undefined ) {

                            switch (elem2.type) {
                                case 1:
                                    // found a user, add to resolve list if not already done
                                    if (resolvelist.users.find(elem2.id) === false) {
                                        resolvelist.users.push(elem2.id);
                                    }
                                    break;
                                case 2:
                                    if (util.findInArray(resolvelist.groups, "id", elem2.id) === false) {
                                        resolvelist.groups.push({id: elem2.id});
                                    }
                                    break;
                                case 3:
                                    if (util.findInArray(resolvelist.resources, "id", elem2.id) === false) {
                                        resolvelist.resources.push({id: elem2.id});
                                    }
                                    break;
                                case 4:
                                    break;

                            }
                        }
                    });
                }

            });

            mox.calendar.resolveParticipants(resolvelist, $.noop);

            if ( typeof(callback) === "function") {
                callback();
            }
        }
    };
    if (requestBody.length !== 0) {
        $.ajax({
            url: url,
            success: success,
            error: errorHandler,
            data: JSON.stringify(requestBody),
            dataType: "json",
            type: "put",
            processData: false
        });
    }
};

/**
 * TODO finish this function

mox.calendar.updateContextData = function() {
    var requestBody = [], url= HOST + "/multiple?continue=true&session=" + session;

    requestBody.push({
        "module": "group",
        "action": "updates",
        "timestamp" : mox.contextData.groups.timestamp
    });

    requestBody.push({
        "module": "resource",
        "action": "updates",
        "timestamp" : mox.contextData.resources.timestamp
    });

    var success = function(data) {
        // TODO
    };

    $.ajax({
        url: url,
        success: success,
        error: errorHandler,
        data: JSON.stringify(requestBody),
        dataType: "json",
        type: "put",
        processData: false,
        contentType: "text/javascript"
    });
};
*/

/**
 * resolve users, groups and resources
 * @param data
 * @param callback
 */
mox.calendar.resolveParticipants = function(participants, callback) {
    _.debug("calendar.resolveParticipants", participants);
    var url= HOST + "/multiple?continue=true&session=" + session;
    var requestBody = [];

    if ( participants.users.length > 0 ) {
        requestBody.push({
            "module" : "user",
            "action" : "list",
            "columns": "1,500",
            "data"   : participants.users
        });
    }
    requestBody.push({
        "module" : "group",
        "action" : "list",
        "data"   : participants.groups
    });

    requestBody.push({
        "module" : "resource",
        "action" : "list",
        "data"   : participants.resources
    });

    var success = function(data) {
        _.debug("calendar.resolveParticipants.success", data);
        var users, groups, resources, t_u, t_g, t_r;
        // shift array if users not present
        if (participants.users.length > 0) {

            users = data[0].data;
            t_u = data[0].timestamp;

            if (data[0].error !== undefined) {
                mox.error.handleError(data[0].error);
            } else {
                mox.contextData.users.timestamp = t_u;

                for (var i = 0; i < users.length; i++) {
                    mox.contextData.users[users[i][0]] = _.compact(users[i]);
                }
            }

            groups = data[1].data;
            t_g = data[1].timestamp;

            resources = data[2].data;
            t_r= data[2].timestamp;


        } else {
            groups = data[0].data;
            t_g = data[0].timestamp;

            resources = data[1].data;
            t_r= data[1].timestamp;
        }
        // groups
        if (data[0].error !== undefined) {
            mox.error.handleError(data[0].error);
        } else {
            mox.contextData.groups.timestamp = t_g;

            for (var j = 0; j < groups.length; j++) {
                mox.contextData.groups[groups[j].id] = groups[j];
            }

        }
        // resources
        if (data[1].error !== undefined) {
            mox.error.handleError(data[1].error);
        } else {
            mox.contextData.resources.timestamp = t_r;

            for (var k = 0; k < resources.length; k++) {
                mox.contextData.resources[resources[k].id] = resources[k];
            }
        }
        if (typeOf(callback) === "function") {
            callback();
        }
    };

    if (requestBody.length !== 0) {
        $.ajax({
            url: url,
            success: success,
            error: errorHandler,
            data: JSON.stringify(requestBody),
            dataType: "json",
            type: "PUT",
            processData: false
        });
    }
};

/**
 * resolves a list of users, i.e. group members, by id if not been done before.
 * @param {Object} Array of user objects
 */
mox.calendar.resolveUsers = function(users, callback) {
    _.debug("calendar.resolveUsers ", users, callback);

    var success = function(users, response) {
        if (users.error === undefined) {
            for (var i = 0; i < users.data.length; i++) {
                var id = users.data[i][0];

                if (mox.contextData.users[id] === undefined) {
                    mox.contextData.users[id] = users.data[i];
                }
            }

            try {
                if (storage.getMode() !== 0) {
                    storage.setItem("contextUsers", mox.contextData.contextUsers, true);
                }
            }
            catch (e) {
               mox.error.newError(e);
            }

            if (typeof(callback) === "function") {
                callback();
            }

        } else {
            delete(mox.contextData.contextUsers);
            mox.error.handleError(users);
        }
    };

    if (users.length > 0) {
        $.ajax({
            url: HOST + "/user?action=list&session=" + session +"&columns=1,500",
            data: JSON.stringify(users),
            success: success,
            error: mox.error.handleError,
            type: "PUT",
            dataType: "json",
            contentType: "text/javascript"
        });
    }

};

/**
 * mox.calendar.resolveContextGroup
 * fetch all context groups from server and store local
 */
mox.calendar.resolveContextGroups = function(list, callback) {
    _.debug("calendar.resolveContextGroups ", list, callback);
    var success = function(groups, response) {
        if(groups.error === undefined) {

            $.each(groups.data, function() {
                mox.contextData.contextGroups[this.id] = this;
            });

            try {
                if (storage.getMode() !== 0) {
                    storage.setItem("contextGroups", mox.contextData.contextGroups, true);
                }
            }
            catch (e) {

            }
            if (typeof(callback) === "function") {
                callback();
            }
            $(events).trigger("context-resources-ready");
        }
        if(groups.error) {
           mox.error.handleError(groups);
        }
    };

    $.ajax({
        url: HOST + "/group?action=search&session=" + session,
        data: JSON.stringify({
            pattern: "*"
        }),
        success: success,
        error: errorHandler,
        type: "PUT",
        dataType: "json",
        contentType: "text/javascript"
    });
};


/**
 * load and resolve a list of resources for the context
 * @param list Array of objects resource ids
 * @param callback function to execute after successful loading
 */
mox.calendar.resolveContextResources = function(list, callback) {
    _.debug("calendar.resolveContextResources ", list, callback);

    var successHandler = function(resources, response){
        if (resources.error) {
            mox.error.handleError(resources);
        } else {
            mox.contextData.contextResources = resources.data;
            try {
                //save resources to localstorage as a json
                if (storage.getMode() !== 0) {
                    storage.setItem("contextResources", resolvedContextResources, true);
                }
            }
            catch (e) {
                // nothing
            }
            if (typeof(callback) === "function") {
                callback();
            }
            $(events).trigger("context-resources-ready");
        }
    };

    $.ajax({
        url: HOST + "/resources?action=list&session=" + session,
        data: JSON.stringify(list),
        success: successHandler,
        error: errorHandler,
        type: "PUT",
        dataType: "json",
        contentType: "text/javascript"
    });
};

/**
 * resolveUserName
 * looks up users,resources,groups,externals specified by an id
 * @param JSON object of resource {id,type}
 * @return JSON object of resolved user,group etc {}
 */
mox.calendar.resolveUserName = function(objectToResolve) {
    _.debug("calendar.resolveUserName", objectToResolve);
    var returnvalue = {};
    switch (objectToResolve.type) {
        case 1:
            $.each(mox.contextData.contextUsers, function(i,elem) {
                if (objectToResolve.id === elem.id) {
                    returnvalue = elem;
                }
            });
            break;

        case 2:
            $.each(mox.contextData.contextGroups, function(i, elem) {
                if (objectToResolve.id === elem.id) {
                    returnvalue = elem;
                }
            });
            break;

        case 3:
            $.each(mox.contextData.contextResources, function(i, elem) {
                if (objectToResolve.id === elem.id) {
                    returnvalue = elem;
                }
            });
            break;

        case 4:
            break; //nothing yet
        case 5:
            returnvalue = objectToResolve;
            break;

    }
    return returnvalue;
};

/**
 * check confirmation for a user
 * @param id
 * @param list
 * @returns
 */
mox.calendar.checkConfirmation = function(user, list) {
    _.debug(2, "calendar.checkConfirmation", user, list);
    // external user without ID ?
    if (user.id === undefined && user.mail !== undefined) {
        for (var j = 0; j <= list.length; j++) {
            if (user.mail && list[j].mail && user.mail === list[j].mail) {
                return list[j].status;
            }
        }
    } else {
        // internal user
        if (user.type !== 2 && user.type !== 4) {
            for (var i = 0; i <= list.length - 1; i++) {
                if (list[i].id === user.id) {
                    return list[i].confirmation;
                }
            }
        }
    }
    return -1;
};

/**
 * return the confirmmessage
 * @param id
 * @param list
 * @returns {Number}
 */
mox.calendar.getConfirmMessage = function(id, list) {
    _.debug("calendar.getConfirmMessage", id, list);
    var m = -1;
    $.each(list, function(i, elem) {
        if (elem.id) {
            if ((elem.id === id.id) && (elem.confirmmessage !== undefined)) {
                m = elem.confirmmessage;
            }
        }
    });
    return m;
};

/**
 * get own confirmation for an appointment
 * @param actualData appointment data, can be array or object
 * @returns
 */
mox.calendar.checkOwnConfirmation = function(actualData) {
    _.debug("calendar.checkOwnConfirmation", actualData);
    var state = '', users = {};
    if (typeOf(actualData) === "array") {
        users = actualData[11];
    }
    if (typeOf(actualData) === "object") {
        users = actualData.users;
    }
    $.each(users, function(i, elem) {
        //check for own confirmation
        if (elem.id === userData.id) {
            switch (elem.confirmation) {
                case 0:
                    state= "new";
                    break;
                case 1:
                    state= "accepted";
                    break;
                case 2:
                    state= "declined";
                    break;
                case 3:
                    state = "tentative";
                    break;
            }
        }
    });
    return state;
};


/**
 * findAppointmentByID
 * find an appointment in list via id and recurrencePostion
 * if recPos == -1 ignore it
 * @param id    integer     Appointment ID
 * @param rP    integer     Reccurence Position
 */
mox.calendar.findAppointmentByID = function(id, rP) {
    _.debug("calendar.findAppointmentByID", id, rP);
    var list = mox.calendar.appointmentLists.all.data,
        app = {};

    for (var i = 0; i < list.length; i++ ) {
        if (list[i][0] == id) {
            if (rP > 0) {
                if (list[i][15] == rP) {
                    app = list[i];
                }
            } else {
                // slect first result
                app = list[i];
            }
        }
    }
    if(_.isEmpty(app)) {
        _.debug(1, 'not found', id, rP);
    }

    return app;
};

/**
 * getAppointmentByID
 * get an appointment object in list via id
 * @param id    integer     Appointment ID
 * @param rP    integer     Reccurence Position
 */
mox.calendar.getAppointmentByID = function(id, rP) {
    var ap = this.findAppointmentByID(id, rP),
        col = this.getColumnsList,
        obj = {};
    if (ap === undefined) {
        return false;
    }
    // dont run until last field as it is a custom ui field
    for (var i = 0; i < ap.length -1; i++) {

        obj[this.resolveField(col[i])] = ap[i];
    }
    return obj;
};

/**
 * getAppointment
 * get an appointment object from server via id
 * @param id    integer     Appointment ID
 * @param rP    integer     Reccurence Position
 * @param cb    function callback on sucess
 * @param cb_error    function callback on error
 */
mox.calendar.getAppointment = function(id, rP, folder, cb, cb_error) {
    _.debug("getAppointment from Server", id, rP);
    if (online) {
        var url = HOST + "/calendar?action=get&session=" + session +
            "&id=" + id + '&folder=' + folder;
        if (rP) {
            url += ('&recurrence_position=' + rP);
        }

        $.ajax({
            url : url,
            success : function(data) {
                if (data.error) {
                    if (cb_error) {
                        cb_error(data);
                    } else {
                        mox.error.handleError(data);
                    }
                } else {
                    // udpdate all appointment data
                    _.debug(1, 'getAppointment from Server Callback', data);
                    if (typeof(cb) === 'function') {
                       cb(data.data);
                    }
                }
            },
            error : cb_error || errorHandler,
            dataType : "json",
            type : "get"
        });
    } else {
        // offline mode
    }
};

/**
 * deleteAppointment
 * delete an appointment from server
 * @param ap    object   current appointment data form local store
 * @param cb    function callback on sucess
 */
mox.calendar.deleteAppointment = function(ap, cb) {
    _.debug("deleteAppointment from Server", ap);
    // build full identifier
    var full_id = {
        id : ap.id,
        folder: ap.folder_id
    };
    if (ap.recurrence_position > 0) {
        full_id.recurrence_position = ap.recurrence_position;
    }
    if (online) {
        var url = HOST + "/calendar?action=delete&session=" + session +
            "&timestamp=" + ap.last_modified;
        $.ajax({
            url : url,
            success : function(data) {
                if (data.error) {
                    mox.error.handleError(data);
                } else {
                    // udpdate all appointment data
                    _.debug(1, 'deleteAppointment from Server Callback', data, ap);
                    if (typeof(cb) === 'function') {
                       cb(data, ap);
                    }
                }
            },
            error : errorHandler,
            data : JSON.stringify(full_id),
            dataType : "json",
            type : "put"
        });
    } else {
        // offline mode
    }
};

/**
 * updateAppointment
 * updates appointment attributes
 * @param ap    object   current appointment data form local store
 * @param diff  object   appointment data to be updated
 * @param cb    function callback on sucess
 * @param ignore    booelan  ignore conflicts
 */
mox.calendar.updateAppointment = function(ap, diff, cb, ignore) {
    _.debug(1, 'updateAppointment', ap, diff, ignore);
    diff.ignore_conflicts = ignore || false;
    if (online) {
        var url = HOST + "/calendar?action=update&session=" + session +
            "&folder=" + ap.folder_id + "&id=" + ap.id + "&timestamp=" + ap.last_modified;
        $.ajax({
            url : url,
            success : function(data) {
                if (data.error) {
                    mox.error.handleError(data);
                } else if (data.data.conflicts && !diff.ignore_conflicts) {
                    mox.calendar.handleConflicts(data.data.conflicts, function() {
                        /* pageloading */
                        mox.calendar.updateAppointment(ap, diff, cb, true);
                    });
                } else {
                    // udpdate all appointment data
                    _.debug(1, 'updateAppointment Callback', data, ap);
                    if (typeof(cb) === 'function') {
                       cb(data, ap);
                    }
                }
            },
            error : errorHandler,
            data : JSON.stringify(diff),
            dataType : "json",
            type : "put"
        });
    } else {
        // offline mode
    }
};

/**
 * createAppointment
 * create new appointment
 * @param diff      object   appointment data to be updated
 * @param cb        function callback on sucess
 * @param ignore    booelan  ignore conflicts
 */
mox.calendar.createAppointment = function(diff, cb, ignore) {
    _.debug(1, 'createAppointment', diff, ignore);
    diff.ignore_conflicts = ignore || false;
    if (online) {
        var url = HOST + "/calendar?action=new&session=" + session;
        $.ajax({
            url : url,
            global: false, // don't trigger ajaxStop
            success : function(data) {
                _.debug(1, 'createAppointment Callback', data);
                if (data.error) {
                    mox.error.handleError(data);
                } else if (data.data.conflicts && !diff.ignore_conflicts) {
                    mox.calendar.handleConflicts(data.data.conflicts, function() {
                        /* pageloading */
                        mox.calendar.createAppointment(diff, cb, true);
                    });
                } else {
                    // udpdate all appointment data
                    if (typeof(cb) === 'function') {
                       cb(data);
                    }
                }
            },
            error : errorHandler,
            data : JSON.stringify(diff),
            dataType : "json",
            type : "put"
        });
    } else {
        // offline mode
    }
};

/**
 * mox.calendar.handleConflicts
 * handle conflicts on update or create
 * @param list      array    conflicts data
 * @param cb        function callback on sucess
 */
mox.calendar.handleConflicts = function(list, cb) {
    /* pageloading */
    var conflicts = [];
    for ( var i = 0; i < list.length; i++ ) {
        conflicts.push(list[i].title);
    }
    var buttons = [{
        text: _i18n("Ignore").toString(),
        delbutton: true,
        action: cb
    }, {
        text: _i18n("Cancel").toString(),
        secondary: true,
        action: $.noop
    }];

    // show overlay
    ui.showAlertBox(_i18n("Conflicts detected").toString(), { buttons: buttons, list: conflicts });
}

/**
 * delete an appointment in list via id and recPos
 * @param id    integer     Appointment ID
 * @param rP    integer     Reccurence Position
 */
mox.calendar.deleteAppointmentByID = function(id, rP) {
    _.debug("calendar.deleteAppointmentByID", id, rP);
    var list = mox.calendar.appointmentLists.all.data, temp = [];

    for ( var i = 0; i < list.length; i++ ) {
        if (list[i][0] == id && list[i][15] == rP) {
           temp = _.without(list, list[i]);
        }
    }
    mox.calendar.appointmentLists.all.data = temp;
};
/**
 * class SeriesObject
 * taken from OX6 GUI, used to resolve the type of a appointment series
 */

var key= "appointments"; /*i18n*/
key= "tasks"; /*i18n*/
SeriesObject.NOSERIES= 0;
SeriesObject.DAILY= 1;
SeriesObject.WEEKLY= 2;
SeriesObject.MONTHLY= 3;
SeriesObject.YEARLY= 4;

SeriesObject.SUNDAY=1;
SeriesObject.MONDAY=2;
SeriesObject.THUESDAY=4;
SeriesObject.WEDNESDAY=8;
SeriesObject.THURSDAY=16;
SeriesObject.FRIDAY=32;
SeriesObject.SATURDAY=64;

SeriesObject.JANUARY=1;
SeriesObject.FEBRUARY=2;
SeriesObject.MARCH=3;
SeriesObject.APRIL=4;
SeriesObject.MAY=5;
SeriesObject.JUNE=6;
SeriesObject.JULY=7;
SeriesObject.AUGUST=8;
SeriesObject.SEPTEMBER=9;
SeriesObject.OCTOBER=10;
SeriesObject.NOVEMBER=11;
SeriesObject.DECEMBER=12;

function SeriesObject (object, createseries) {
    this.disabled=false;
    this.old_recurrence_type=null;
    this.old_days=null;
    this.old_day_in_month=null;
    this.old_month=null;
    this.old_interval=null;
    this.old_until=null;
    this.old_occurrences=null;
    /*
     * NOSERIES= 0 ; DAILY= 1; WEEKLY= 2; MONTHLY= 3; YEARLY= 4;
     */
    this.recurrence_type = 0;
    /*
     * Null not set.
     * Add up integer of in week days; or the day of series in monthview;
     */
    this.days=null; //WEEK,MONTH,YEAR
    /*
     * Null not set.
     * which day of a month is part of the sequence. Counting starts with 1. counting all days set in days or if days not set all days.
     */ 
    this.day_in_month=null; //MONTH,YEAR
     /*
      * Null not set.
      * Month of series
      */
    this.month=null; //YEAR
     /*
      * Interval of series each number week,month,day 
      */
    this.interval=null; //DAY,WEEK,MONTH || YEAR=1
    /*
     * Null not set 
     * End date of the series, if not set and occcurences not set series is unlimited
     */
     this.until=null; //DATE OF END
     /*
      * Null not set
      * Count of series not set
      */
     this.occurrences=null; //COUNT OF OCCURENCES
     
     if(object) {
        this.setParameters(object,createseries);
     }
}
SeriesObject.prototype = {
    hasNoChanges : function () {
        if(this.old_recurrence_type != this.recurrence_type) { return false; }
        else if(this.old_days != this.days) { return false; }
        else if(this.old_day_in_month != this.day_in_month) { return false; }
        else if(this.old_month != this.month) { return false; }
        else if(this.old_interval != this.interval) { return false; }
        else if(this.old_until != this.until) { return false; }
        else if(this.old_occurrences != this.occurrences) { return false; }
        return true;        
    },
    setParameters : function(responseobject,createseries, forceNew) {
        if(!responseobject) {
            return;
        }
        if(responseobject.recurrence_position && !createseries) {
            this.disabled=true;
            //REMOVE IF IS VALID TO CREATE SERIES
            return;
        }
        if(responseobject.recurrence_type != undefined) {
            if (!forceNew) this.old_recurrence_type = parseInt(responseobject.recurrence_type);
            this.recurrence_type=parseInt(responseobject.recurrence_type);
        }
        if(responseobject.days != undefined) {
            if (!forceNew) this.old_days=parseInt(responseobject.days);
            this.days=parseInt(responseobject.days);
        }
        if(responseobject.day_in_month != undefined) {
            if (!forceNew) this.old_day_in_month=parseInt(responseobject.day_in_month);
            this.day_in_month=parseInt(responseobject.day_in_month);
        }
        if(responseobject.month != undefined) {
            if (!forceNew) this.old_month=parseInt(responseobject.month);
            this.month=parseInt(responseobject.month);
        }
        if(responseobject.interval != undefined) {
            if (!forceNew) this.old_interval=parseInt(responseobject.interval);
            this.interval=parseInt(responseobject.interval);
        }
        if(responseobject.until != undefined) {
            if (!forceNew) this.old_until=responseobject.until;
            this.until=responseobject.until;
        }
        if(responseobject.occurrences != undefined) {
            if (!forceNew) this.old_occurrences=parseInt(responseobject.occurrences);
            this.occurrences=parseInt(responseobject.occurrences);
        }
    },
    getSeriesString : function() {
        function getCountString (countint) {
            switch (countint) {
                case 1:
                    return _i18n("first");
                case 2:
                    return _i18n("second");
                case 3:
                    return _i18n("third");
                case 4:
                    return _i18n("fourth");
                case 5:
                case -1:
                    return _i18n("last"); 
            }
        }
        function getMonthString(monthint) {
            var mymonth=[_i18n("January"),_i18n("February"),_i18n("March"),_i18n("April"),_i18n("May"),_i18n("June"),_i18n("July"),_i18n("August"),_i18n("September"),_i18n("October"),_i18n("November"),_i18n("December")];
            return mymonth[monthint];
        }
        function getDayString(daysint) {
            var daystring="";
            switch (daysint) {
                case 62:
                    daystring=_i18n("Work Day");
                    break;
                case 65:
                    daystring=_i18n("Weekend Day");
                    break;
                case 127:
                    daystring=_i18n("Day");
                    break;
                default:
                    if (((daysint % SeriesObject.MONDAY) / SeriesObject.SUNDAY) >= 1) {
                        (daystring=="") ? daystring=daystring + _i18n("Sunday") : daystring=daystring + ", "+_i18n("Sunday"); 
                    }                   
                    if (((daysint % SeriesObject.THUESDAY) / SeriesObject.MONDAY) >= 1) {
                        (daystring=="") ? daystring=daystring + _i18n("Monday") : daystring=daystring + ", "+_i18n("Monday"); 
                    }                   
                    if (((daysint % SeriesObject.WEDNESDAY) / SeriesObject.THUESDAY) >= 1) {
                        (daystring=="") ? daystring=daystring + _i18n("Tuesday") : daystring=daystring + ", "+_i18n("Tuesday"); 
                    }                   
                    if (((daysint % SeriesObject.THURSDAY) / SeriesObject.WEDNESDAY) >= 1) {
                        (daystring=="") ? daystring=daystring + _i18n("Wednesday") : daystring=daystring + ", "+_i18n("Wednesday"); 
                    }                   
                    if (((daysint % SeriesObject.FRIDAY) / SeriesObject.THURSDAY) >= 1) {
                        (daystring=="") ? daystring=daystring + _i18n("Thursday") : daystring=daystring + ", "+_i18n("Thursday"); 
                    }                   
                    if (((daysint % SeriesObject.SATURDAY) / SeriesObject.FRIDAY) >= 1) {
                        (daystring=="") ? daystring=daystring + _i18n("Friday") : daystring=daystring + ", "+_i18n("Friday"); 
                    }                   
                    if ((daysint / SeriesObject.SATURDAY) >= 1) {
                        (daystring=="") ? daystring=daystring + _i18n("Saturday") : daystring=daystring + ", "+_i18n("Saturday"); 
                    }
            }
            return daystring;
        }
        var returnstring;
        var interval=this.interval;
        var recurrence_type=this.recurrence_type;
        var days=this.days;
        var day_in_month=this.day_in_month;
        var month=this.month;
        var until=this.until;
        var occurences=this.occurences;
        if(this.hasNoChanges()) {
            interval=this.old_interval;
            recurrence_type=this.old_recurrence_type;
            days=this.old_days;
            day_in_month=this.old_day_in_month;
            month=this.old_month;
            until=this.old_until;
            occurrences=this.old_occurrences;
        }
        switch (this.recurrence_type) {
            case 0:
                returnstring = _i18n("No recurrence");
                break;
            case 1: 
                returnstring = format(_i18n("Each %s Day"),interval);
                break;
            case 2:
                returnstring = format(_i18n("Each %s Week(s) on %s"),[interval, getDayString(days)]);
                break;
            case 3:
                if (this.days==null) {
                    returnstring = format(_i18n("On %s. day every %s. month"),[day_in_month,interval]);
                } else {
                    returnstring = format(_i18n("On %s %s each %s. months"),[getCountString(day_in_month),getDayString(days),interval]);
                }
                break;
            case 4:
                if (this.days==null) {
                    returnstring = format(_i18n("Each %s. %s"),[day_in_month,getMonthString(month)]);
                } else {
                    returnstring = format(_i18n("On %s %s in %s"),[getCountString(day_in_month), getDayString(days),getMonthString(month)]);
                }
                break;
        }
        return returnstring;
    }
};
mox.calendar.itip = function() {

    _.debug("mox.calendar.itip: init");

    var regex = /text\/calendar.*?method=(.+)/i,
        n_count = [ _i18n("last"), "", _i18n("first"), _i18n("second"), _i18n("third"), _i18n("fourth"), _i18n("last") ],
        shownAsClass = "reserved temporary absent free".split(' '),
        n_shownAs = [ _i18n("Reserved"), _i18n("Temporary"), _i18n("Absent"), _i18n("Free") ],
        MINUTE = 60000,
        HOUR = 60 * MINUTE,
        DAY = 24 * HOUR,
        WEEK = 7 * DAY;

    var i18n = {
        'accept': _i18n("Accept"),
        'accept_and_replace': _i18n("Accept changes"),
        'accept_and_ignore_conflicts': _i18n("Accept"),
        'accept_party_crasher': _i18n("Add new participant"),
        'create': _i18n("Accept"),
        'update': _i18n("Accept changes"),
        'delete': _i18n("Delete"),
        'declinecounter': _i18n("Reject changes"),
        'tentative': _i18n("Tentative"),
        'decline': _i18n("Decline"),
        'ignore': _i18n("Ignore")
    };

    var buttonClasses = {
        'accept': 'custom-button-success ',
        'accept_and_replace': 'custom-button-inverse',
        'accept_and_ignore_conflicts': 'custom-button-success',
        'accept_party_crasher': 'custom-button-inverse',
        'create': 'custom-button-inverse',
        'update': 'custom-button-inverse',
        'delete': 'custom-button-inverse',
        'declinecounter': 'custom-button-danger',
        'tentative': 'custom-button-warning',
        'decline': 'custom-button-danger',
        'ignore': ''
    };

    var success = {
        'accept': _i18n("You have accepted the appointment"),
        'accept_and_replace': _i18n("Changes have been saved"),
        'accept_and_ignore_conflicts': _i18n("You have accepted the appointment"),
        'accept_party_crasher': _i18n("Added the new participant"),
        'create': _i18n("You have accepted the appointment"),
        'update': _i18n("The appointment has been updated"),
        'delete': _i18n("The appointment has been deleted"),
        'declinecounter': _i18n("The changes have been rejected"),
        'tentative': _i18n("You have tentatively accepted the appointment"),
        'decline': _i18n("You have declined the appointment")
    };

    var successInternal = {
        'accept': _i18n("You have accepted the appointment"),
        'decline': _i18n("You have declined the appointment"),
        'tentative': _i18n("You have tentatively accepted the appointment")
    };

    var priority = ['update', 'ignore', 'decline', 'tentative', 'accept',
                    'declinecounter', 'accept_and_replace', 'accept_and_ignore_conflicts',
                    'accept_party_crasher', 'create', 'delete'];

    var getRecurrenceString = function (data) {
        _.debug("mox.calendar.itip.getRecurrenceString", data);

        function getCountString(i) {
            return n_count[i + 1];
        }
        function getDayString(i) {
            var tmp = [];
            switch (i) {
            case 62:
                tmp.push(_i18n("Work Day"));
                break;
            case 65:
                tmp.push(_i18n("Weekend Day"));
                break;
            case 127:
                tmp.push(_i18n("Day"));
                break;
            default:
                if ((i % MONDAY) / SUNDAY >= 1) {
                    tmp.push(_i18n("Sunday"));
                }
                if ((i % THUESDAY) / MONDAY >= 1) {
                    tmp.push(_i18n("Monday"));
                }
                if ((i % WEDNESDAY) / THUESDAY >= 1) {
                    tmp.push(_i18n("Tuesday"));
                }
                if ((i % THURSDAY) / WEDNESDAY >= 1) {
                    tmp.push(_i18n("Wednesday"));
                }
                if ((i % FRIDAY) / THURSDAY >= 1) {
                    tmp.push(_i18n("Thursday"));
                }
                if ((i % SATURDAY) / FRIDAY >= 1) {
                    tmp.push(_i18n("Friday"));
                }
                if (i / SATURDAY >= 1) {
                    tmp.push(_i18n("Saturday"));
                }
            }
            return tmp.join(", ");
        }

        function getMonthString(i) {
            return formatDateTime("MMM", new Date(mox.calendar.now()));
        }

        var str = "", f = _.printf,
            interval = data.interval,
            days = data.days || null,
            month = data.month,
            day_in_month = data.day_in_month;

        switch (data.recurrence_type) {
        case 1:
            str = f(_i18n("Each %s Day"), interval);
            break;
        case 2:
            str = interval === 1 ?
                f(_i18n("Weekly on %s"), getDayString(days)) :
                f(_i18n("Each %s weeks on %s"), interval, getDayString(days));
            break;
        case 3:
            if (days === null) {
                str = interval === 1 ?
                    f(_i18n("On %s. day every month"), day_in_month) :
                    f(_i18n("On %s. day every %s. month"), day_in_month, interval);
            } else {
                str = interval === 1 ?
                    f(_i18n("On %s %s every month"), getCountString(day_in_month), getDayString(days)) :
                    f(_i18n("On %s %s each %s. months"), getCountString(day_in_month), getDayString(days), interval);
            }
            break;
        case 4:
            if (days === null) {
                str = f(_i18n("Each %s. %s"), day_in_month, getMonthString(month));
            } else {
                str = f(_i18n("On %s %s in %s"), getCountString(day_in_month), getDayString(days), getMonthString(month));
            }
            break;
        }

        return str;
    }

    var getDate = function (timestamp) {
        _.debug("mox.calendar.itip.getDate", timestamp);

        var d = timestamp !== undefined ? mox.calendar.getUTCTS(new Date(timestamp)) : ox.calendar.now();
        return formatDate(d, 'dateshortday').toString();
    }

    var getDateInterval = function (data) {
        _.debug("mox.calendar.itip.getTimeInterval", data);

        var length = (data.end_date - data.start_date) / DAY >> 0,
            startDate = data.start_date,
            endDate = data.end_date;
        if (data.full_time) {
            startDate = mox.calendar.getUTCTS(new Date(startDate));
            endDate = mox.calendar.getUTCTS(new Date(endDate));
        }

        if (length > 1) {
            return getDate(startDate) + " \u2013 " + getDate(endDate - 1);
        } else {
            return getDate(startDate);
        }
    }

    var getTimeInterval = function (data) {
        _.debug("mox.calendar.itip.getTimeInterval", data);

        var startdate = new Date(mox.calendar.getUTCTS(new Date(data.start_date))),
            enddate = new Date(mox.calendar.getUTCTS(new Date(data.end_date)));

        if (data.full_time) {
            var timeString = _i18n("All day").toString();
            // full time for one day
            if (!util.date.equalsDay(startdate, enddate)) {
                // all day for multiple days
                return _i18n('All day').toString() + ': '
                    + formatDate(startdate, "date").toString()
                    + " - " + formatDate(enddate, "date").toString();
            }
        } else if (util.date.equalsDay(startdate, enddate)) {
            // start and end on same day
            return formatDate(startdate, "time").toString() + " - "
                + formatDate(enddate, "time").toString();
        } else {
            // longer than one day
            return formatDate(startdate, "datetime").toString() + " - "
                + formatDate(enddate, "datetime").toString();
        }
    }

    var getShownAsClass = function (data) {
        _.debug("mox.calendar.itip.getShownAsClass", data);

        return shownAsClass[(data.shown_as || 1) - 1];
    }

    var getShownAs = function (data) {
        _.debug("mox.calendar.itip.getShownAs", data);

        return n_shownAs[(data.shown_as || 1) - 1];
    }

    var getConfirmations = function (data) {
        _.debug("mox.calendar.itip.getConfirmations", data);

        var hash = {};
        // internal users
        _(data.users).each(function (obj) {
            hash[String(obj.id)] = {
                status: obj.confirmation || 0,
                comment: obj.confirmmessage || ""
            };
        });
        // external users
        _(data.confirmations).each(function (obj) {
            hash[obj.mail] = {
                status: obj.status || 0,
                comment: obj.confirmmessage || ""
            };
        });
        return hash;
    }

    var getConfirmationStatus = function (obj, id) {
        _.debug("mox.calendar.itip.getConfirmationStatus", obj, id);

        var hash = getConfirmations(obj),
            user = id || userID;
        return hash[user] ? hash[user].status : 1;
    }

    function getConfirmationSelector(status) {
        _.debug("mox.calendar.itip.getConfirmationSelector", status);

        if (status === 1) return 'button.btn-success.accept';
        if (status === 2) return 'button.btn-danger';
        if (status === 3) return 'button.btn-warning';
        return '';
    }

    function drawConfirmation(data) {
        _.debug("mox.calendar.itip.drawConfirmation", data);

        // 0 = none, 1 = accepted, 2 = declined, 3 = tentative
        var status = getConfirmationStatus(data),
            message = '', className = '';

        if (data.organizerId === userID) {
            message = _i18n('You are the organizer').toString();
            className = 'organizer';
            return $('<div class="confirmation-status">').addClass(className).text(message);
        }

        if (status > 0) {
            switch (status) {
            case 1:
                message = data.type !== 'task' ?
                    _i18n('You have accepted this appointment') :
                    _i18n('You have accepted this task');
                className = 'accepted';
                break;
            case 2:
                message = data.type !== 'task' ?
                    _i18n('You declined this appointment') :
                    _i18n('You declined this task');
                className = 'declined';
                break;
            case 3:
                message = data.type !== 'task' ?
                    _i18n('You tentatively accepted this invitation') :
                    _i18n('You tentatively accepted this task');
                className = 'tentative';
                break;
            }
            return $('<div class="confirmation-status">').addClass(className).text(message.toString());
        }
        return $();
    }

    function getNote(data) {
        _.debug("mox.calendar.itip.getNote", data);

        return $.trim(data.note || "")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/</g, "&lt;")
            .replace(/(https?\:\/\/\S+)/g, '<a href="$1" target="_blank">$1</a>');
    }

    function drawSummary(data) {
        _.debug("mox.calendar.itip.drawSummary", data);

        var recurrenceString = getRecurrenceString(data);
        return [
            $('<b>').text(data.title),
            $.txt(', '),
            $('<span class="day">').append(
                  $.txt(getDateInterval(data)),
                  $.txt((recurrenceString !== '' ? ' \u2013 ' + recurrenceString : ''))
            ),
            // confirmation
            drawConfirmation(data)
        ];
    }

    function drawDetails(baton) {
        _.debug("mox.calendar.itip.drawDetails", baton);

        var defaultReminder = data = baton.appointment || baton.task,
            status = getConfirmationStatus(data),
            selector = getConfirmationSelector(status),
            accepted = status === 1;

        var info = baton.$.well.find('.appointmentInfo');
        info.append.apply(info,
            drawSummary(data)
        );

        var buttonContainer = baton.$.well.find('.itip-actions').addClass('block');

        if (accepted) {
            baton.$.well.find('.itip-action-container').remove();

        } else {
            // append buttons
            buttonContainer.append.apply(buttonContainer,
                    _([ 'decline', 'tentative', 'accept' ]).chain()
                    .map(function (action) {
                        return $('<a>')
                            .attr({
                                href: "#",
                                'data-role': 'button',
                                'data-inline': 'true',
                                'data-mini': 'true',
                                'data-theme': 'c',
                                'data-action': action })
                            .addClass(buttonClasses[action])
                            .text(i18n[action].toString())
                            .add(
                                $.txt('\u00A0')
                            );
                    }).value()
            ).on('tap', 'a', function (e) {
                e.preventDefault();

                var action = $(this).attr('data-action');
                if (action === 'ignore') {
                    // deleteMailIfNeeded(baton);
                }

                // be busy
                toggleSpinner(true);

                mox.calendar.confirmAppointment(
                    { id: defaultReminder.id, folder: defaultReminder.folder_id },
                    action === 'decline' ? 2 : action === 'tentative' ? 3 : 1,
                    "",
                    function(e) {
                        toggleSpinner(false);

                        if (!e.error) {
                            mox.calendar.getUpdates();
                            ui.showAlertBox(successInternal[action].toString(), {
                                buttons: [{
                                    text: _i18n("Ok").toString(),
                                    action: function() {
                                        baton.$.well.empty();
                                        // update well
                                        drawScaffold.call(baton.$.well, data.type);
                                        if (data.type === 'appointment') {
                                            loadAppointment(baton);
                                        }
                                    }
                                }]
                            });
                        }
                    }
                );
            })
            // disable buttons - don't know why we have an array of appointments but just one set of buttons
            // so, let's use the first one
            .find(selector).addClass('disabled').attr('disabled', 'disabled');
        }

        $('a[data-role^="button"]', buttonContainer).button();
        baton.$.well.show();
        baton.$.well.parent().show();
    }

    function drawWell() {
        _.debug("mox.calendar.itip.drawWell");

        return $('<div class="well itip-changes">').hide();
    }

    function drawScaffold(type) {
        _.debug("mox.calendar.itip.drawScaffold", type);

        var text = type !== 'task' ?
            _i18n('This email contains an appointment') :
            _i18n('This email contains a task');
        return this.append(
            $('<div class="muted mail-detail-row-bg">').css({ paddingLeft: "5px" }).text(text.toString()),
            $('<div class="appointmentInfo">').css({ padding: "5px" }),
            $('<div class="itip-action-container">').css({ textAlign: 'right' }).append(
                $('<div class="itip-actions">')
            )
        );
    }

    function toggleSpinner(show) {
        _.debug("mox.calendar.itip.toggleSpinner", show);
    }

    function renderInternalAppointment(data) {
        _.debug("mox.calendar.itip.renderInternalAppointment", data);

        if (data.headers['X-OX-Reminder']) {
            var $well, module = data.headers['X-Open-Xchange-Module'],
                reminder = data.headers['X-OX-Reminder'], address;
            if (/^(Appointments|Tasks)/.test(module)) {
                address = reminder.split(/,\s*/);
                if (module === 'Appointments') {
                    data.$ = $();
                    $("#itip").empty()
                    .append(
                        drawScaffold.call(data.$.well = drawWell(), 'appointment')
                    );
                    data.appointment = { module: 'appointment', folder_id: address[1], id: address[0] };
                    loadAppointment(data)
                }
            }
        }
    }

    function loadAppointment(baton) {
        _.debug("mox.calendar.itip.loadAppointment", baton);
        if (online) {
            mox.calendar.getAppointment(baton.appointment.id, 0, baton.appointment.folder_id, function(appointment) {
                appointment.type = 'appointment';
                baton.appointment = appointment;
                _.debug("mox.calendar.itip.loadAppointment", baton);
                drawDetails(baton);
            }, $.noop);
        }
    }

    function discoverIMipAttachment(object) {
        return _(object.data.attachments).find(function (attachment) {
            var match = attachment.content_type.match(regex);
            if (match && match[1].toLowerCase() !== "publish") {
                var index = match[1].indexOf(";");
                var method = index !== -1 ? match[1].substr(0, index) : match[1];
                method = method.toLowerCase();
                _.debug("mox.calendar.itip.discoverIMipAttachment", object, method);
                return method !== 'publish';
            }
            _.debug("mox.calendar.itip.discoverIMipAttachment", object, false);
            return false;
        });
    }

    function analyzeAttachment(object) {
        _.debug("mox.calendar.itip.analyzeAttachment", object)

        // toggleSpinner
        toggleSpinner(true);

        return $.ajax({
            url: HOST + "/calendar/itip?action=analyze&dataSource=com.openexchange.mail.ical"
                      + "&descriptionFormat=html&timezone=UTC&session=" + session,
            type: "PUT",
            data: JSON.stringify({
                "com.openexchange.mail.conversion.fullname": object.data.folder_id,
                "com.openexchange.mail.conversion.mailid": object.data.id,
                "com.openexchange.mail.conversion.sequenceid": object.imip.attachment.id
            }),
            error: mox.error.handleError,
            dataType: "json"
        }).pipe(function(data) {
            return data.data;
        }).always(function(data) {
            _.debug("mox.calendar.itip.analyzeAttachment:always:", data);
            // hide loading spinner
            toggleSpinner(false);
        });
    }

    function renderAppointment(appointment, baton) {
        _.debug("mox.calendar.itip.renderAppointment", appointment, baton);

        if (!appointment) {
            return $();
        }

        var $node = $("<div>");

        var recurrenceString = getRecurrenceString(appointment);
        $node.append(
            // interval
            $('<div>').addClass('appointment-date')
            .append(
                $('<div>').addClass('interval')
                .append(
                    $('<span class="day">').append(
                        $.txt(getTimeInterval(appointment))
                    )
                ),
                $('<div>').addClass('day')
                .append(
                    $.txt(getDateInterval(appointment)),
                    $.txt(' \u2013 ' + (recurrenceString !== '' ? recurrenceString : _i18n('No recurrence')))
                )
            ),
            // title
            $('<div>').addClass('title clear-title').text(appointment.title || ""),
            // location
            $('<div>').addClass('location').text(appointment.location || "\u00A0"),
            $('<div>').addClass('note').css({ wordBreak: 'break-all' }).html(getNote(appointment)),
            $('<br>')
        );

        // prepare users array
        var resolve = { users: [], groups: [], resources: [] };
        $.each(appointment.participants, function(i, val) {
            if (val.type === 1) {
                if (resolve.users.find(val.id) === false) {
                    resolve.users.push(val.id);
                }
            } else if (val.type === 2) {
                if (util.findInArray(resolve.groups, "id", val.id) === false) {
                    resolve.groups.push({ id: val.id });
                }
            } else if (val.type === 3) {
                if (util.findInArray(resolve.resources, "id", val.id) === false) {
                    resolve.resources.push({ id: val.id });
                }
            }
        });

        // push some more users into resolve array
        if (appointment.organizerID) {
            resolve.users.push(appointment.organizerID);
        }
        if (appointment.created_by) {
            resolve.users.push(appointment.created_by);
        }

        var $participantDiv = $('<ul>')
            .attr({ id: 'itip-participants', 'data-role': 'listview', 'data-inset': 'true' });
        $node.append($participantDiv);

        // resolve users
        if (online) {
            mox.calendar.resolveParticipants(resolve, function(users) {
                $participantDiv.append(appointmentViewer.getParticipantsNode(appointment));
                // create listview element
                $participantDiv.listview();
            });
        }

        var $details = $('<div>').addClass('details')
        $node.append($details);

        $details.append(
            $('<span>')
            .addClass("detail-label")
            .append(
                $.txt(_i18n("Show as")), $.txt(":\u00A0")
            ),
            $('<span>')
            .addClass("detail shown_as " + getShownAsClass(appointment))
            .append(
                $.txt("\u00A0")
            ),
            $('<span>')
            .addClass("detail shown-as")
            .append(
                $.txt("\u00A0"),
                $.txt(getShownAs(appointment))
            ),
            $('<br>')
        );

        // creation date and created by
        if (appointment.creation_date || appointment.created_by) {
            var $created = $('<span>');
            if (online && appointment.created_by) {
                mox.calendar.resolveUsers([ appointment.created_by ], function() {
                    if (mox.contextData.users && mox.contextData.users[appointment.created_by]) {
                        $created.text(mox.contextData.users[appointment.created_by][1]);
                    }
                });
            }
            $details.append(
                $('<span class="detail-label">').append(
                    $.txt(_i18n('Created')),
                    $.txt(':\u00A0')
                ),
                $('<span class="detail created">').append(
                    $.txt(appointment.creation_date ? formatDate(appointment.creation_date, "datetime").toString() : ''),
                    $('<span>').text(appointment.creation_date ? ' \u2013 ' : ''),
                    $created
                ),
                $('<br>')
             )
        }

        // organizer
        if (appointment.organizer || appointment.organizerID) {
            $details.append(
                $('<span class="detail-label">').append(
                    $.txt(_i18n('Organizer')), $.txt(':\u00A0')
                ),
                $('<span class="detail organizer">').append(
                    $.txt(appointment.organizer ? appointment.organizer :
                        appointment.organizerId ? mox.calendar.resolveUserName({ id: appointment.organizerID, type: 1 }) : ''
                    )
                ),
                $('<br>')
             );
        }

        return $node;
    }

    function renderDiffDescription(change) {
        _.debug("mox.calendar.itip.renderDiffDescription", change);

        if (!change.diffDescription) {
            return $();
        }

        var $list = $('<div class="changes">');

        _(change.diffDescription || []).each(function (diffEntry) {
            $list.append($('<div>').html(diffEntry));
        });

        return $list;
    }

    function renderAnnotation($node, annotation, analysis, baton) {
        _.debug("mox.calendar.itip.renderAnnotation", $node, annotation, analysis, baton);

        $node.append(
            $('<div class="annotation">').append(
                $('<div class="message alert">').append(annotation.message),
                renderAppointment(annotation.appointment, baton)
            )
        );
    }

    function renderChange($node, change, analysis, baton) {
        _.debug("mox.calendar.itip.renderChange", $node, change, analysis, baton);

        $node.append(
            $('<div class="change">').append(
                renderConflicts(change),
                renderAppointment(change.newAppointment || change.currentAppointment || change.deletedAppointment, baton)
            )
        );
    }

    function renderConflicts(change) {
        _.debug("mox.calendar.itip.renderConflicts", change);

        if (!change.conflicts) {
            return $();
        }
        var $node = $("<div>");
        var text = format(ngettext('You already have %1$d appointment in this timeframe.',
            'You already have %1$d appointments in this timeframe.', change.conflicts.length), change.conflicts.length);

        $node.append(
            $('<div class="alert alert-info">').append(
                $.txt(text),
                $.txt(' '),
                $('<a>', { href: '#' })
                .text(_i18n('Show conflicts').toString())
                .on('click', function (e) {
                    e.preventDefault();

                    $node.find(".alert").remove();
                    var cont = $('<div>').css({ marginBottom: "1em" })
                        .append($('<span>').addClass('error').text(_i18n('Conflicts detected').toString()));

                    $node.append(cont);
                    _(change.conflicts).each(function(conflict) {
                        var conf = $('<div>').addClass('conflict-row');
                        var title = '', conflictsWith = '';
                        if (mox.contextData.users) {
                            title = ' (' + mox.contextData.users[conflict.created_by][1] + ')';
                            if (conflict.participants && conflict.participants.length >= 1) {
                                conflictsWith = ' ' + mox.contextData.users[conflict.participants[0].id][1];
                            }
                        }
                        conf.append(
                            $('<div>').addClass('conflict-title').text(conflict.title + title),
                            $('<div>').addClass('conflict-date').text((conflict.full_time ? '' : getDateInterval(conflict)) + ' ' + getTimeInterval(conflict)),
                            $('<div>').addClass('conflict-location').text(conflict.location || ' '),
                            $('<div>').addClass('conflicts').text(_i18n('Conflicts:').toString() + conflictsWith)
                        );
                        cont.append(conf);
                    });
                })
            )
        );

        return $node;
    }

    function renderAnalysis($node, baton) {
        _.debug("mox.calendar.itip.renderAnalysis", $node, baton);

        // empty node first
        $($node).empty();

        function rerender(baton) {
            _.debug("mox.calendar.itip.renderAnalysis.rerender", baton);

            analyzeAttachment(baton).done(function (results) {
                baton.analysis = results[baton.index];
                render(baton);
            });
        }

        function render(baton) {
            _.debug("mox.calendar.itip.renderAnalysis.render", baton);

            var appointments = [];

            _(baton.analysis.annotations).each(function (annotation) {
                if (annotation.appointment) {
                    appointments.push(annotation.appointment);
                }
            });

            _(baton.analysis.changes).each(function (change) {
                // preference on currentAppointment, so that we can show the current status
                var appointment = change.currentAppointment || change.newAppointment || change.deletedAppointment;
                if (appointment) {
                    appointments.push(appointment);
                }
            });

            var appointment = appointments[0],
                status = getConfirmationStatus(appointment),
                selector = getConfirmationSelector(status),
                accepted = status === 1,
                $well = drawWell();

            if (baton.$.well) {
                baton.$.well.replaceWith($well);
            }

            drawScaffold.call(baton.$.well = $well, 'app');

            if (accepted) {
                baton.analysis.actions = _(baton.analysis.actions).without('decline', 'tentative', 'accept');
            }

            var buttonContainer = baton.$.well.find('.itip-actions').addClass('block');

            buttonContainer.append.apply(buttonContainer,
                _(priority).chain()
                .filter(function (action) {
                    return _(baton.analysis.actions).contains(action);
                })
                .map(function (action) {
                    return $('<a>')
                        .attr({
                            href: "#",
                            'data-role': 'button',
                            'data-inline': 'true',
                            'data-mini': 'true',
                            'data-theme': 'c',
                            'data-action': action })
                        .addClass(buttonClasses[action])
                        .text(i18n[action].toString())
                        .add(
                            $.txt('\u00A0')
                        );
                }).value()
            ).on('click', 'a', function (e) {
                e.preventDefault();

                var action = $(this).attr('data-action');
                if (action === 'ignore') {
                    //deleteMailIfNeeded(baton);
                }

                // be busy
                toggleSpinner(true);

                $.ajax({
                    url: HOST + "/calendar/itip?action=" + action + "&dataSource=com.openexchange.mail.ical"
                    + "&descriptionFormat=html&timezone=UTC&session=" + session,
                    type: "PUT",
                    data: JSON.stringify({
                        "com.openexchange.mail.conversion.fullname": baton.data.folder_id,
                        "com.openexchange.mail.conversion.mailid": baton.data.id,
                        "com.openexchange.mail.conversion.sequenceid": baton.imip.attachment.id
                    }),
                    error : errorHandler,
                    success: function(data) {
                        if (data.error) {
                            mox.error.handleError(data);
                        } else {
                            baton.$.well.empty();
                            //
                            $(events).trigger('refresh-calendar');
                            // update well
                            rerender(baton);
                            // show confirmation
                            ui.showAlertBox(success[action].toString(), {
                                buttons: [{
                                    text: _i18n("Ok").toString(),
                                    action: $.noop
                                }]
                            });
                        }
                    }
                }).always(function() {
                    toggleSpinner(false);
                });
            })
            // disable buttons - don't know why we have an array of appointments but just one set of buttons
            // so, let's use the first one
            .find(selector).addClass('disabled').attr('disabled', 'disabled');

            var info = baton.$.well.find('.appointmentInfo');
            info.append.apply(info,
                _(appointments).map(function (appointment) {
                    var out = $('<div>');
                    return out.append.apply(out, drawSummary(appointment));
                })
            );

            _(baton.analysis.changes).each(function (change) {
                baton.$.well.find('.appointmentInfo').append(renderDiffDescription(change));
            });

            if (appointments.length === 0) {
                baton.$.well.find(".muted").remove();
            }

            $('a[data-role^="button"]', buttonContainer).button();
            baton.$.well.show();
        }

        baton.$ = $();

        baton.imip.analysis = baton.analysis;

        // Let's remove the ITip Attachments
        baton.data.attachments = _(baton.data.attachments).filter(function (attachment) {
            return !(/\.ics$/).test(attachment.filename);
        });

        // draw well
        if (baton.analysis.actions.length !== 1 || baton.analysis.actions[0] !== 'ignore') {
            render(baton);
            $node.append(baton.$.well);
        }

        // Annotations
        _(baton.analysis.annotations).each(function (annotation) {
            renderAnnotation($node, annotation, baton.analysis, baton);
        });

        // Changes
        _(baton.analysis.changes).each(function (change) {
            renderChange($node, change, baton.analysis, baton);
        });
    }

    return {
        discoverIMipAttachment: discoverIMipAttachment,
        analyzeAttachment: analyzeAttachment,
        renderAnalysis: renderAnalysis,
        renderInternalAppointment: renderInternalAppointment
    };
};
/**
 * All content on this website (including text, images, source code and any
 * other original works), unless otherwise noted, is licensed under a Creative
 * Commons License.
 * 
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * 
 * Copyright (C) 2004-2010 Open-Xchange, Inc. Mail: info@open-xchange.com
 * 
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

mox.maps = { 
    init : function() {
        mox.maps.apiloaded = true;
        mox.maps.Geocoder = new google.maps.Geocoder();
        $(events).trigger("maps-api-loaded");
    },  
    
    apiloaded: false,
    
    googleMapsAPIUrl: "https://maps.google.com/maps/api/js?sensor=false&callback=mox.maps.init",
    
    loadMapsAPI: function() {
        if (!mox.maps.apiloaded) {
            $.getScript(mox.maps.googleMapsAPIUrl);
        }
    },
    geocodeAddress: function(address, callback) {
        var marker;
        mox.maps.Geocoder.geocode({address: address}, function(results, status) {
            if (status === "OK") {
                // everything fine
                marker = new google.maps.Marker({
                    position: results[0].geometry.location
                });
                callback(results, marker);
            } else {
                // error, address could not be resolved
                /* pageloading */
                ui.showAlertBox(_i18n("An error occurred.").toString(), {
                    buttons: [
                              {text: _i18n("Ok").toString(),
                               action: function() {
                                   ui.blockScreen(false);
                               }
                              }
                           ]});
                
                mox.error.newError("[MAPS] Invalid address.");
            }
        });
    },
    geocodeCoord: function(coords) {
        var latlng = new google.maps.LatLng(coords.latitude, coords.longitude);
        return latlng;
    },
    getCurrentPosition: function(callback) {
        if (Modernizr.geolocation) {
            navigator.geolocation.getCurrentPosition(callback);
        }
    },
    setMarker: function(options) {
        var marker = new google.maps.Marker({
            position: options.latlng, 
            map: mox.maps.map, 
            title: options.title || undefined
        });
    },
    drawMap: function(address) {
        if (this.apiloaded) {
            
            var ZOOM = 13;
            var defaultAddress = {
                    country: "",
                    zip: "",
                    town: "",
                    street: ""
            };
            $.extend(defaultAddress, address);
            
            var addressString = defaultAddress.street +
                "," + defaultAddress.zip + "," +
                defaultAddress.town + "," +
                defaultAddress.country;
            
            this.geocodeAddress(addressString, function(results, marker) {
                
                mox.maps.center = results[0].geometry.location;
                var myOptions = {
                    zoom: ZOOM,
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    center: results[0].geometry.location
                };
                if (mox.maps.map === undefined) {
                    mox.maps.map = new google.maps.Map(document.getElementById("map_canvas"),
                            myOptions);
                } else {
                    // nothing
                }
                if (mox.maps.marker !== undefined) {
                    // remove old marker
                    mox.maps.marker.setMap(null);
                }
                mox.maps.marker = marker;
                mox.maps.marker.setMap(mox.maps.map);
                
                setTimeout( function() { $(events).trigger("maps-map-ready"); }, 250);
                
            });
        } else {
            $(events).bind("maps-api-loaded", function() {
                mox.maps.drawMap(address);
            });
            this.loadMapsAPI();
        }
        /*
        var infoWindow = new google.maps.InfoWindow({
            content: '<p>Current Latitude: ' + latlng.lat() + '</p><p>Current Longitude: ' + latlng.lng() + '</p>',
            position: latlng
        });
        */
        //infoWindow.open(map, marker);
    },
    
    getStaticMapImage : function (address, options) {

        var serviceurl = "http://maps.google.com/maps/api/staticmap?";
        if(!address) {
            return false;
        }
        var addressString = address.street + "," + address.zip +
            " " + address.town + "";//+ address.country;
        
        var defaults = {
            center: '"' +addressString + '"',
            markers:'"'+ addressString +'"',
            mobile: "true",
            sensor: "false",
            size: screen.availWidth + "x"+ screen.availHeight , // maps maximum is 640x640 px
            zoom: "15",
            maptype: "roadmap" // roadmap, satellite, hybrid, und terrain.
        };
        var urlString = serviceurl;
        $.extend(defaults, options);
        $.each(defaults, function(e,elem) {
            urlString += e + "=" + elem + '&';
        });
       
        return urlString;
    }
};
/**
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

/***********************************/


// extend namespace
mox.mail = {
    folderIDMap : {},
    initCount : 10
};

globalMailListViews = {};

mox.mail.isStandardFolder = function(folder, ignoreTrash) {
    ignoreTrash = ignoreTrash || false;
    var standard = false;
    $.each(localUserConfig.folderTree.standardMailFolders, function(i, elem) {
        if (elem.id === folder) {
            if (ignoreTrash && (i === '4_trash' || i === '3_spam')) {

            } else {
                standard = i;
            }
        }
    });
    return standard;
};

mox.mail.isCountFolder = function(folder, privateOnly) {
    privateOnly = privateOnly || false;
    if (privateOnly) {
        return $.inArray(folder, localUserConfig.subscribedFolders.mail) > -1;
    } else {
        return !!(mox.mail.isStandardFolder(folder, true) || $.inArray(folder, localUserConfig.subscribedFolders.mail) > -1);
    }
};

/**
 * gets folder infos via id from the map
 */
mox.mail.getFolderFromMap = function(folder) {
    var theFolder = false;
    var index = -1;
    $.each(mox.mail.folderIDMap, function(i, elem) {
        if (folder === elem.folderid) {
            theFolder = elem;
            index = i;
        }
    });

    theFolder.index = index;

    return theFolder;
};

/**
 * add a folder to the ID map
 * return the id of the new folder or the id of
 * a already existing folder
 */
mox.mail.addFolderToMap = function(folder, folderid) {
    var id = 0;
    var id_exist = -1;
    var set = false;
    $.each(mox.mail.folderIDMap, function(i, elem) {
        id++;
        if (folderid === elem.folderid) {
            set = true;
            id_exist = i;
        }
    });

    if (!set) {
        mox.mail.folderIDMap[id] = {
                folder: folder,
                folderid: folderid
        };

        // save for offline mode
        try {
            if (storage.getMode() !== 0) {
                storage.setItem("folderIDMap", mox.mail.folderIDMap, true);
            }
        } catch(e) {
            mox.error.newError("[Storage] Error during save", e);
        }
    }
    return (id_exist === -1) ? id: id_exist;
};


/**
 * get mail attachment from backend
 * @param {Object} object contains id and jsessionid
 */
mox.mail.getAttachment = function(object) {
    var url = "";
    var id;
    id = (object.id !== undefined) ? object.id : object;

    // watch for backward compability, only use jsessionid if server sends it
    var jsessionid = (object.jsessionid !== undefined) ? object.jsessionid : false;
    var jsessionstring = "";
    // set node explicit by providing JSESSIONID in request
    if (jsessionid !== false) {
        jsessionstring = ";"+ JSESSIONID +"=" + jsessionid;
    }
    // build link
    if (id !== undefined) {
        url = HOST +
            "/mail.attachment" + jsessionstring +"?id=" + id +
            "&save=1&filter=1";
    }

    return url;
};

/**
 * deletes specific mails
 * @param {Array} array of folder and id objects {id: xxx , folder: xxx}
 * @param {Object} callback
 */
mox.mail.deleteMails = function(mails, callback) {
    var url = HOST + "/mail?action=delete&session=" + session;
    var requestBody = [];

    requestBody.push({
        "module":"mail",
        "action":"delete",
        "folder": mails[0].folder,
        "data": []
        });

    $.each(mails, function(i, elem) {
        requestBody[0].data.push({id: elem, folder: elem.folder});
    });

    $.ajax({
        url: url,
        data: JSON.stringify(mails),
        success: function(e) {
            if (e.error) {
                mox.error.handleError(e);
            } else {
                callback();
            }
        },
        error: mox.error.handleError,
        type: "put",
        dataType: "json"
    });
};


/**
 * prepares a given mail for reply
 * @param {Object} mail
 * @param {Boolean} replyall true if reply to all
 */
mox.mail.prepareReplyMail = function(mail, replyall) {
    mox.mail.resetMailObject();
    mox.mail.resetMailForm();
    mailnotsend = true;
    var action = (replyall === true) ? "replyall" : "reply";
    var id = mail.data.id;
    var folder = mail.data.folder_id;
    var url = HOST + "/mail";
    var data = {
            "action": action,
            "id": id,
            "session":session,
            "folder":folder,
            "view":"text"
    };

    $("#emailText").empty();
    $("#appendText").empty();
    $("#emailText").attr({style: "height:20px;"});

    var successHandler = function(mailData, response, error) {
        if (mailData.error) {
            mox.error.handleError(mailData);
        } else {
            var recp = "";
            var ccs = "";
            $.each(mailData.data.to, function(i,elem){
                recp += elem[1];
                if( (mailData.data.to.length > 1) && (i !== mailData.data.to.length-1)) {
                    recp += ", ";
                }
            });
            $.each(mailData.data.cc, function(i,elem){
                ccs += elem[1];
                if( (mailData.data.cc.length > 1) && (i !== mailData.data.cc.length-1)) {
                    ccs += ", ";
                }
            });
            mox.mail.resetMailForm();

            $("#eMailTo").val(recp);
            $("#eMailCC").val(ccs);
            $("#eMailSubject").val(mailData.data.subject);

            var text = $("#emailText").parent();
            text.append("<div id='appendText'>" + mailData.data.attachments[0].content + "</div>");
            text.attr({style: "font: 16px Monospace !important; word-break:normal;word-wrap:break-word"});
        }
    };

    $.ajax({
        url: url,
        data:data,
        success: successHandler,
        error: mox.error.handleError,
        type: "get",
        dataType: "json"
    });
};


/**
 * getAllMailFolders triggers fetching each of the
 * mail folders
 */
mox.mail.getAllMailFolders = function(callback) {
     _.debug("mail.getAllMailFolders", callback);
     // list of all mail folders
     var list = [];


     $.each(localUserConfig.folderTree.standardMailFolders, function(i, elem) {
        list.push({
            folder: elem.id,
            name: elem.title,
            standardfolder: i
        });
     });
     var templist = [];
     $.each(localUserConfig.subscribedFolders.mail, function(i, elem) {
        // test if folder id is still valid
        var folder_ok = $.grep(localUserConfig.folderTree.mailFolders, function(j, index) {
            return (j.folder == elem);
        });
        // only load foldercontent if id is still valid
        if (folder_ok.length !== 0) {
            var foldername = mox.folder.getFolderName(elem);
            list.push({
                folder: elem,
                name: foldername,
                standardfolder: false
            });
        } else {
            mox.error.newError("Error: [Mail] Subscribed folder " + elem +
                " has moved or was deleted. Removing from subscription list.");
            // add the broken id to temp array
            templist.push(elem);
        }

     });
     // remove all old missing folders from subscription list
     var cleanList = _.difference(localUserConfig.subscribedFolders.mail, templist);
     localUserConfig.subscribedFolders.mail = cleanList;

     mox.mail.getAllIDs(list, function() {
         if (typeof(callback) === "function") {
             callback();
         }
     }, {update: false});
};

// the list of mail IDs
mox.mail.mailIDLists = { };

/**
 * mox.mail.getAllIDs
 * @param {Object|Array} Array of objects
 * @example
 * [{
 *      name:"Trash",
 *      folder:"default0/INBOX/Trash"
 *      standardfolder: true
 *  },
 *  {
 *      name:"Test123",
 *      folder:"default0/INBOX/Test123"
 *      standardfolder: false
 *  }]
 * @param {function} callback to call after ajax has finished
 */
mox.mail.getAllIDs = function(folders, callback, dataOptions) {
    _.debug("mail.getAllIDs", folders);
    /* pageloading */
    var requestBody = [];
    var columns = "600,611";
    var url = HOST + "/multiple?session="+ session;

    // the default mail limit
    var limit = mox.mail.initCount;

    var folderlimits = [];
    var update = dataOptions.update || false;

    if (update) {
        // look for individual limits
        var ilimit;
        $.each(folders, function(i, j) {
            ilimit = globalMailListViews[j.folder].getCurrentMailCount();
            if ( ilimit > limit) {
                folderlimits.push(ilimit);
            } else {
                folderlimits.push(limit);
            }
        });
    }

    $.each(folders, function(i,elem) {
        requestBody.push({
        "module":"mail",
        "action":"all",
        "columns":columns,
        "folder": elem.folder,
        "sort":"610",
        "order":"desc"
        });
    });

    var successHandler = function(idLists, response, requestObject) {
        if (idLists.error) {
            mox.error.handleError(idLists);
        } else {
            var options = {};

            $.each(idLists, function(i, elem) {

                if (update) {
                    // set the individual limits for each folder
                    limit = folderlimits[i];
                }

                // save IDs for later mail loading
                mox.mail.mailIDLists[folders[i].folder] = elem.data;

                if (elem.data) {
                    options[i] = {
                       mailList: [],
                       folder: folders[i].folder,
                       folder_name: folders[i].folder,// store name for later use
                       standardfolder : folders[i].standardfolder,
                       count: elem.data.length
                    };
                    var tempUnread = 0;
                    for (var j = 0; j < elem.data.length; j++) {
                        var elemj = elem.data[j];

                        // count unread mails
                        if ((elemj[1] & 32) === 0) {
                            //increment temp unread mails
                            tempUnread++;
                        }

                        // only load LIMIT mails by default
                        if (j < limit) {
                            options[i].mailList.push({
                                id: elemj[0],
                                folder: folders[i].folder
                            });
                        }
                    }

                    var folderid = folders[i].folder;
                    unreadMails[folderid] = tempUnread;

                } else if (elem.error) {
                    mox.error.handleError(elem);
                }
            });

            try {
                if (storage.getMode() !== 0) {
                    storage.setItem("unreadMails", unreadMails, true);
                    storage.setItem("mailFolderOptions", options, true);
                }
            } catch (e) {
                mox.error.newError("[Storage] Error during save", e);
            }

            // send callback to next function
            mox.mail.getMailList(options, function() {
                if (typeof(callback) === "function") {
                    callback();
                }
            }, dataOptions);
        }
    };

    $.ajax({
        url: url,
        success: successHandler,
        error: mox.error.handleError,
        data: JSON.stringify(requestBody),
        dataType: "json",
        type: "put",
        processData: false
    });
};

/**
 * getMoreMails
 * load a given count of mails from a folder which have not been
 * loaded yet
 * data.folder = folder to load
 * data.count = count of mails to load after last loaded mail
 */
mox.mail.getMoreMails = function(data, callback) {
    _.debug("mail.getMoreMails", data);

    /* pageloading */

    // shift the mailids
    var shift = data.shift || 0,
        folder = data.folder,
        count = data.count,
        listView = globalMailListViews[folder],
        actualOffset = listView.getLength(),
        standardfolder = data.standardfolder,
        idList = mox.mail.mailIDLists[folder],
        idsToFetch = _.first(_.rest(idList, actualOffset + shift), count), // get next elements from idList
        columns = "600,603,607,610,611,602,604",
        url = HOST + "/mail?action=list&columns=" + columns +"&session=" + session,
        rqBody = [];

    $.each(idsToFetch, function(i, elem) {
        rqBody.push({
           id: elem[0],
           folder: folder
        });
    });

    var successHandler = function(data, status) {

        // find position of this folder in storage array
        var index = util.findInArray(localUserConfig.storage.mailStorageList, "id", folder);
        var list = mailLists[index].data;

        // concat new mails with loaded mails
        var newList = list.concat(data.data);

        // add to global list of mails
        mailLists[index].data = newList;

        // save lists to storage
        try{
            if(storage.getMode() !== 0){
                storage.setItem("mailList_" + folder, mailList, true);
            }
        }catch(e) {

        }
        var unread = 0;
        $.each(data.data, function(i, mail) {

            if ((mail[4] & 32) === 0) {
                unread++;
            }

            var sender = mail[1];
            var senderName;
            // resolve display name if set
            if (sender[0][0] === "" || sender[0][0] === null) {
                senderName = sender[0][1];
            } else {
                senderName = sender[0][0];
            }

            var recipients = mail[6];
            var recipientsText = "";

            // resolve recipients display names
            $.each(recipients, function(k, elem){
                if (elem[0] !== "" && elem[0] !== null) {
                    recipientsText += elem[0];
                } else {
                    recipientsText += elem[1];
                }
                if (recipients.length > 1) {
                    recipientsText += "; ";
                }

            });

            // append a new single row to listview
            listView.appendRow({
                id: mail[0],
                folder: folder,
                subject:mail[2],
                sender: (standardfolder === "1_sent") ? recipientsText : senderName, // for sent we need to display the recipients
                date: util.date.formatDate(mail[3],"date"), //formatDate(mail[3],"date").toString(),
                bits: mail[4],
                attachment: mail[5],
                action: (function(mailid, folderid) {

                    return function() {
                        // show loader
                        /* pageloading */
                        // fetch mail from backend
                        mox.mail.getMail({id: mailid, attachment: mail[5]}, folderid, function(mailobject) {

                            $("#itip").hide();
                            var itip = new mox.calendar.itip();
                            var imipAttachment = itip.discoverIMipAttachment(mailobject);

                            if (online && imipAttachment && localUserConfig.activeModules.calendar === true) {
                                mailobject.imip = { attachment: imipAttachment };
                                itip.analyzeAttachment(mailobject)
                                .done(function (analysis) {
                                    $("#itip").show();
                                    _(analysis).each(function (a, index) {
                                        var clone = _.clone(mailobject);
                                        clone = $.extend(clone, { analysis: a, index: index });
                                        itip.renderAnalysis($("#itip"), clone);
                                    });
                                })
                            }

                            //callback after mail was loaded
                            // draw the mail
                            mailviewer.drawMail({
                                id: mailid, // the view must know which mail it shows
                                folder: folder, // the view also knows the folder
                                to: mailobject.data.to,
                                cc: mailobject.data.cc,
                                from: mailobject.data.from,
                                text: mailobject.data.attachments[0].content,
                                time: formatDate(mailobject.data.received_date, "datetime").toString(),
                                subject: mailobject.data.subject,
                                themail: mailobject.data,
                                imip: imipAttachment
                            });
                            //change page and dismiss the loader
                            $.mobile.changePage("#maildetail", {transition: transitions.slide, changeHash: false});
                            /* pageloading */
                        });
                    };
                    })(mail[0], folder)
            });
        });

        // ask listview for count of mails
        var mailcount = listView.getLength();

        if (mailcount < mox.mail.mailIDLists[folder].length) {
            // there are still mails in this folder, move button to end of list
            listView.moveLoadMoreButton();
        } else {
            // all mails have been loaded
            listView.removeLoadMoreButton();
        }

        listView.refresh();
        ui.mail.updateCountBubbles();
        /* pageloading */
        // execute callback
        if (typeof(callback) === "function") {
            callback();
        }
    };

    $.ajax({
        url: url,
        success: successHandler,
        error: mox.error.handleError,
        data: JSON.stringify(rqBody),
        dataType: "json",
        type: "put",
        processData: false
    });

};

/**
 * getMailList
 * fetches a list of mails specified in an array of IDs
 * @param mailsToFetch Array of mail IDs
 * @param callback to be executed after success
 */
mox.mail.getMailList = function(mailsToFetch, callback, options) {
    _.debug("mail.getMailList", mailsToFetch);

    /* pageloading */

    var columns = "600,603,607,610,611,602,604";
    var url = HOST + "/multiple?session=" + session;

    var rqBody = [];
    $.each(mailsToFetch, function(i, elem) {

        rqBody.push({
            action: "list",
            columns: columns,
            module: "mail",
            data: elem.mailList
        });
    });

    var successHandler = function(mailArrays, response, requestObject) {

        // we receive an array of objects
        if (mailArrays.error) {
            //handle error
            mox.error.handleError(mailArrays);
        } else {
            //globalMailListViews = {};
            $.each(mailArrays, function(i, elem) {
                if (elem.data === undefined && elem.error !== undefined) {
                    mox.error.newError(format(elem.error, elem.error_params));
                    return;
                }
                var folderid = mailsToFetch[i].folder;
                var foldername = mox.folder.getFolderName(folderid);
                var standard = mailsToFetch[i].standardfolder;

                // store stuff
                // search in mailStorageList for an object with name == foldername
                if (util.findInArray(localUserConfig.storage.mailStorageList, "id", folderid) === false) {

                    localUserConfig.storage.mailStorageList.push({
                        location: "mailList_" + folderid,
                        name: foldername,
                        id: mailsToFetch[i].folder,
                        standardfolder: standard
                    });
                }
                // add to global list of mails
                mailLists.push(elem);

                try {
                    if(storage.getMode() !== 0){
                        storage.setItem("mailList_" + folderid, elem, true);
                    }
                } catch(e){
                    // storage error
                }

                var maildrawoptions = {
                        foldername: foldername,
                        folderid: folderid,
                        mails: elem.data,
                        mailList: mailsToFetch[i],
                        standardfolder: standard
                    };
                // draw the list
                mox.mail.drawMailList(maildrawoptions, options);

            });

            // init the mail lists for reading
            ui.mail.updateCountBubbles();

            try {
                if (storage.getMode() !== 0) {
                    storage.setItem("mailLists", localUserConfig.storage.mailStorageList, true);
                }
            }catch(e) {
                mox.error.newError("[Storage] Error during save: " + e);
            }

            // gui.menuUpdater(unreadMails.all());
            if (typeof(callback) === "function") {
                callback();
            }
        }
    };

    // We're getting a list of mails specified in
    // requestBody. This array was build by getAllIDs(),
    // according to localUserConfig.mailCount
    $.ajax({
        url: url,
        success: successHandler,
        error: mox.error.handleError,
        data: JSON.stringify(rqBody),
        dataType: "json",
        type:"put",
        processData: false
    });
};

/**
 * drawMailList
 * draws a mail list with given data
 * data {
 *      foldername: String
 *      folderid: String
 *      mails: Array
 *      mailList: Array
 *      update: Boolean
 * }
 * if update is set to true, no new folder
 * will be drawn to the folder selection
 */
mox.mail.drawMailList = function(data, options) {
    var opt = $.extend(options, { }),
        update = opt.update || false,
        foldername = data.foldername,
        folderid = data.folderid,
        mails = data.mails,
        mailList = data.mailList,
        standardfolder = data.standardfolder;
    // add folder to foldermap
    var id = mox.mail.addFolderToMap(foldername, folderid);
    // add a container to draw list

    if (!update) {
        if (data.standardfolder !== false) {
            // standard folder
            ui.page.addListContainer("listcontainer_" + id, "#singleMailFolder");
        } else {

            // private folder
            ui.page.addListContainer("listcontainer_" + id, "#singlePrivateMailFolder");
            ui.page.addPrivateFolderToList(data.foldername, id);
        }

        ui.page.addPage({
            id: "mf_" + id,
            headerid: "mf_header_" + id,
            contentid: "mf_content_"+ id,
            footerid: "mf_footer_"+ id,
            folder: folderid
        });

        // add the folder to the "move to folder" page for mail move
        ui.page.addPrivateFolderToMoveList(data.foldername, id);
    }
    // add new listview object, providing the container
    globalMailListViews[folderid] = new MailListView($("#mf_content_"+id), {
                folder: folderid,
                internalid: id
    });

    if (localUserConfig.folderTree.standardMailFolders["2_drafts"].id === folderid) {
        globalMailListViews[folderid].setAsDraftFolder(true);
    }

    globalMailListViews[folderid].refresh();
    globalMailListViews[folderid].show();


    // if a folder is empty create a special list row
    if (mails.length === 0) {
        //globalMailListViews[folderid].setEmptyMessage(_i18n("Folder is empty").toString());
        globalMailListViews[folderid].showListEmptyMessage();
        $('#cancelEditButtonmf_' + id).hide();
    } else {
        $('#cancelEditButtonmf_' + id).show();
    }


    // add each mail to listview
    $.each(mails, function(k, mail) {
        var sender = mail[1],
            senderName = "";

        // sendername can be empty, so don't rely on this
        if (sender[0]) {
            if (sender[0][0] === "" || sender[0][0] === null) {
                senderName = sender[0][1];
            } else {
                senderName = sender[0][0];
            }
        }
        var recipients = mail[6];
        var recipientsText = "";

        $.each(recipients, function(k, elem){
            if (elem[0] !== "" && elem[0] !== null) {
                recipientsText += elem[0];
            } else {
                recipientsText += elem[1];
            }
            if (recipients.length > 1) {
                recipientsText += "; ";
            }

        });

        globalMailListViews[folderid].appendRow({
            id: mail[0],
            folder: folderid,
            subject:mail[2],
            sender: (standardfolder === "1_sent") ? recipientsText : senderName,
            date: util.date.formatDate(mail[3],"date"),
            bits: mail[4], // bitmask for state of mail
            attachment: mail[5],
            action: (function(mailid, folderid) {
                    return function() {
                        mox.mail.getMail({id: mailid, attachment: mail[5]}, folderid, function(mailobject) {

                            $("#itip").hide();
                            var itip = new mox.calendar.itip();
                            var imipAttachment = itip.discoverIMipAttachment(mailobject);

                            if (online && imipAttachment && localUserConfig.activeModules.calendar === true) {
                                mailobject.imip = { attachment: imipAttachment };
                                itip.analyzeAttachment(mailobject)
                                .done(function (analysis) {
                                    $("#itip").show();
                                    _(analysis).each(function (a, index) {
                                        var clone = _.clone(mailobject);
                                        clone = $.extend(clone, { analysis: a, index: index });
                                        itip.renderAnalysis($("#itip"), clone);
                                    });
                                })
                            }

                            mailviewer.drawMail({
                                id: mailid, // the view must know which mail it shows
                                folder: folderid, // the view also knows the folder
                                to: mailobject.data.to,
                                cc: mailobject.data.cc,
                                from: mailobject.data.from,
                                text: mailobject.data.attachments[0].content,
                                time: formatDate(mailobject.data.received_date, "datetime").toString(),
                                subject: mailobject.data.subject,
                                themail: mailobject.data,
                                imip: imipAttachment
                            });

                            $.mobile.changePage("#maildetail", {transition: transitions.slide, changeHash: false});

                            /* pageloading */
                            // test for unread flag

                            if ((mail[4] & 32) === 0) {
                                // decrement unread mails
                                unreadMails[folderid]--;
                                // update menu
                                ui.mail.updateCountBubbles();
                            }

                        });
                    };
                })(mail[0], folderid)
        });

    });

    globalMailListViews[folderid].refresh();
    globalMailListViews[folderid].setMailCount(mailList.count);

    // if there are more than mox.mail.initCount mails, show load more button
    if (mailList.count > mox.mail.initCount) {
        globalMailListViews[folderid].addLoadMoreButton({
            //#. label for a button which loads more mails from server and appends it to a list of mails
            text: _i18n("Load more...").toString(),
            action: function() {
                if (online) {
                    mox.mail.getMoreMails({
                        folder: folderid,
                        standardfolder: standardfolder,
                        count: mox.mail.initCount
                    }, $.noop);
                } else {
                    ui.showOfflineMessage();
                }
            }
        });
    }
    // trigger event when done
    $(events).trigger("maillist_ready", {
        folder: folderid ,
        pageData: {
            id: "mf_" + id,
            headerid: "mf_header_" + id,
            contentid: "mf_content_"+ id,
            footerid: "mf_footer_"+ id
        }
    });
};

/**
 * get a draftmail from server
 * @param mailid
 * @param folder
 * @param callback
 */
mox.mail.getDraftMail = function(id, folder, callback) {
    _.debug("mail.getDraftMail", id, folder);

    //online mode
    if (online) {

        var url = HOST + "/mail";
        var data = {
            "action": "get",
            "id": id,
            "folder": folder,
            "session": session,
            "view": "text"
        };

        var successHandler = function(theMail, response, requestObject) {
            if (theMail.error !== undefined) {
                mox.error.handleError(theMail);
            } else {
                callback(theMail);
            }
        };
        $.ajax({
            url: url,
            data: data,
            success: successHandler,
            error: mox.error.handleError, //errorHandler,
            type: "get",
            dataType: "json"
        });

    }
};

/**
 * get a mail from server
 * @param {Object} mailObject
 * @param {Object} folder
 */
mox.mail.getMail = function(mailObject, folder, callback) {
    _.debug("mail.getMail", mailObject, folder);
    var ttl = 1000 * 60 * 60 * 24; // 24 hours ttl for attachment token

    //online mode
    if (online) {

        var url = HOST + "/mail";
        var data = {
            "action": "get",
            "id": mailObject.id,
            "folder": folder,
            "session": session,
            "view": "text",
            "ttlMillis": ttl,
            "token": "true" // get attachments via token without need of ox cookies
        };

        var successHandler = function(theMail, response, requestObject) {
            if (theMail.error !== undefined) {
                mox.error.handleError(theMail);
            } else {

                var mailAlreadyFetched = false;

                for(var i = 0; i <= loadedMails.length -1; i++) {
                    if (loadedMails[i].data.id === theMail.data.id) {
                        mailAlreadyFetched = true;
                    }
                }

                if (!mailAlreadyFetched) {
                    loadedMails.push(theMail);
                    try{
                        if (storage.getMode() !== 0) {
                            storage.setItem("loadedMails", loadedMails, true);
                        }
                    }catch(e) {
                        //mox.error.newError("[Storage] Error during save: " + e);
                    }
                }
                callback(theMail);
            }
        };
        $.ajax({
            url: url,
            data: data,
            success: successHandler,
            error: mox.error.handleError, //errorHandler,
            type: "get",
            dataType: "json"
        });

    } else {

        /* pageloading */

        // offline mode
        var isInStore = false;
        if (loadedMails) {
            // look through email store
            for (var i = 0; i <= loadedMails.length -1; i++) {
                if (loadedMails[i].data.id === mailObject.id) {
                    isInStore = true;
                    callback(loadedMails[i]);
                }
            }
            if (isInStore === false ) {
                //#. shown if the app is offline and the mail was not loaded before
                ui.showAlertBox(_i18n("Mail has not been loaded yet.").toString(), {buttons: [{
                    text: _i18n("Ok").toString(),
                    action: function() {
                        /* pageloading */
                        }
                    }
                 ]});
            }
        } else {
            // TODO
            // show "not loaded" mail message
            // we don't have the mailstorage
            //#. shown if the app is offline and the mail was not loaded before
            ui.showAlertBox(_i18n("Mail has not been loaded yet.").toString(), {buttons: [{
                text: _i18n("Ok").toString(),
                action: function() {
                        /* pageloading */
                    }
                }
             ]});
            /* pageloading */
        }
    }
};


/**
 * removes a local stored email folder
 */
mox.mail.removeLocalMailFolder = function(folder) {

    var f = mox.mail.getFolderFromMap(folder);
    // remove html part
    $("#mf_" + f.index).remove();
    delete(globalMailListViews[folder]);
    ui.page.removePrivateFolder(folder);

    //remove from storage
    var list = null;
    try {
        list = storage.getItem("mailLists", true);
    } catch(e) {
        mox.error.newError("[STORAGE] Error during restore, " + e);
    }
//    var foldertoremove;
//    $.each(list, function(i, elem) {
//        if (elem.id === folder) {
//            foldertoremove = i;
//        }
//    });

    try {
        storage.removeItem("mailList_" + folder);
    } catch(e) {
        mox.error.newError("[STORAGE] Error during remove, " + e);
    }

    try {
        storage.setItem("mailLists", list, true);
    } catch(e) {

    }
};

//TODO
mox.mail.updateMailFolderSelection = function(subscribedFolders) {
    var tempStorageList = [];
    var ids = [];
    $.each(localUserConfig.storage.mailStorageList, function(i, elem) {

        var standardFolder = false;

        // do we have a standard folder
        $.each(localUserConfig.folderTree.standardMailFolders, function(f, folder) {
            if (folder.id === elem.id) {
                standardFolder = true;
            }
        });
        // is the folder a non standard folder and is not subscribed
        if (subscribedFolders.find(elem.id) === false && (standardFolder === false)) {
            // remove this folder
            // tempStorageList.splice(i,1);
            ids.push(i);
            mox.mail.removeLocalMailFolder(elem.id);

        }
    });

    $.each(localUserConfig.storage.mailStorageList, function(i, elem) {
        if(ids.find(i) === false) {
            tempStorageList.push(elem);
        }
    });
    // replace with new one
    localUserConfig.storage.mailStorageList = tempStorageList;

    localUserConfig.subscribedFolders.mail = subscribedFolders;
};

/**
 * resolve state from mail flags
 */
mox.mail.getFlags = function(flag) {
    if ((flag & 0x101) == 0x101) return "reply_forward";
    if (flag & 0x100) return "forward";
    if (flag & 0x001) return "reply";
    if (flag & 0x002) return "deleted";
    if (flag & 0x020) return "read";
    return "unread";
};

mox.mail.flagmapping = {
    "seen" : { flag : 32 , bool : true} ,
    "unseen" : { flag : 32 , bool : false} ,
    "answer" : { flag : 1 , bool : true} ,
    "answered" : { flag : 1 , bool : false},
    "delete" : { flag : 2 , bool : true} ,
    "undelete" : { flag : 2 , bool : false},
    "spam" : { flag : 128 , bool : true} ,
    "ham" : { flag : 128 , bool : false}
};

/**
 * update flags for a specific mail or a set of mails
 * mails = [{folder:XXX, mailid:XXX, flag:"seen"}, {...}]
 * After this the callback will be executed
 */
mox.mail.updateMailFlags = function(mails, callback) {
    var requestBody = [];
    var url = HOST + "/multiple?session="+ session;
    var flag;

    $.each(mails, function(i, elem) {

        flag = mox.mail.flagmapping[elem.flag];

        requestBody.push({
            action : "update",
            module : "mail",
            timestamp : 0,
            id : elem.mailid,
            folder : elem.folder,
            data : {
                flags : flag.flag,
                value :  flag.bool
            }
        });
    });
    // success
    var successHandler = function(mailData, response, error) {
        if (mailData.error) {
            mox.error.handleError(mailData);
        } else {
            // execute callback if set
            if (typeof(callback) === "function") {
                callback(mailData);
            }
        }
    };

    $.ajax({
        url: url,
        success: successHandler,
        error: mox.error.handleError,
        data: JSON.stringify(requestBody),
        dataType: "json",
        type: "put",
        processData: false
    });
};

/**
 * moves one ore more mails to a specific folder
 * @param data, [{id:XXX, srcfolder:XXX, destfolder: XXX}, {...}]
 */
mox.mail.moveMail = function(data, callback, errorcallback) {
    /* pageloading */
    var requestBody = [];
    var url = HOST + "/multiple?session="+ session;

    $.each(data, function(i, elem) {
        requestBody.push({
            action : "update",
            module : "mail",
            folder: elem.srcfolder,
            id: elem.id,
            data : {
                folder_id: elem.destfolder
            }
        });
    });

    var successHandler = function(e) {

        /* pageloading */
        var error = false;
        $.each(e, function(i, elem){
            if (elem.error) {
               errorcallback(elem);
               error = true;
               return;
            }
        });
        if (!error) {
            callback();
        }
    };

    $.ajax({
        url: url,
        success: successHandler,
        error: mox.error.handleError,
        data: JSON.stringify(requestBody),
        dataType: "json",
        type: "put",
        processData: false
    });
};

/**
 * shows a status message
 */
mox.mail.showMoveStatusMessage = function(message, options) {
    $("#mailmoveinfo").text(message);
    if (options.time) {
        setTimeout(function() {
            //$("#mailmoveinfo").hide();
            if (options.callback) {
                options.callback();
            }
        }, options.time);
    }
    if (message === "") {
        $("#mailmoveinfo").hide();
    }
};

/**
 * updateMailFolders
 * get all IDs and load mails, refresh maillist
 * @param folders array of folderids
 */
mox.mail.updateMailFolders = function(folders, callback) {
    var list = [];
    var foldername;
    var standardfolder = '';

    $.each(folders, function(i, elem) {
        foldername = mox.mail.getFolderFromMap(elem);
        foldername = foldername.folder;
        standardFolder = mox.mail.isStandardFolder(elem);
        list.push({
            folder: elem,
            name: foldername,
            standardfolder: standardfolder
        });
    });
    mox.mail.getAllIDs(list, callback, {update: true});
};

mox.mail.isValidEmail = function(eMail) {
    // TODO
    return true;
};

mox.mail.rows = [];

/**
 * addMailRecipients
 * adds a new row the mail compose showing the recipient as
 * a bubble contact field
 * @param field String, "to", "cc", "bcc"
 * @param email String, "test@test.com"
 */
mox.mail.addMailRecipient = function(field, email, text) {
    // get a new row at right position
    var $newRow = ui.mail.newmail.addToRow(field);
    mox.mail.rows.push($newRow);

    var $node = $("<div>").addClass("contact-bubble-border"),
        $text = $("<span>"),
        $icon = $("<span>").addClass("crossicon"),
        label = field.substr(0,1).toUpperCase() + field.substr(1);
    // remove action on cross icon
    $icon.bind("tap", function(){
        $(events).trigger("newmail_contact_remove", {email: email, field: field});
        var $tr = $(this).closest('tr');
        // remove the row and paint label to new first row
        var $table = $tr.closest('table');
        $tr.remove();

        $table
            .find("[data-actual=true]")
            .attr("data-actual","false");
        $table
            .find("[data-selector]:first")
            .text(_i18n(label + ':').toString())
            .attr("data-actual","true");

    });

    // set text of bubble
    $text.text(text);
    $node.append($icon).append($text);

    // find the row to append
    $newRow.find(".row-selector").append($node);
};
/**
 * clears all set mail recipients to reset the mailform
 */
mox.mail.clearMailRecipients = function() {
    $("#newmail .crossicon").trigger("tap");
};

/**
 * add an attachment to the list at the end of mail page
 */
mox.mail.drawAttachments = function(data) {
    var $list = $("#mail-detail-attachment-list").show();
    var $li = $("<li>");
    var $a = $("<a>").attr({
        "href": data.href || "#",
        "target" : "_blank", // ensure to open in a new page
        "rel": "external",
        "data-ajax": "false" // don't load via ajax
        });
    if (data.action) {
        $a.bind("touchstart mousedown", function() {
            data.action();
        });
    }
    var $icon = $("<div>").addClass("attachment-icon");
    var $filename = $("<div>").addClass("attachment-filename");
    var $subtitle = $("<span>").addClass("attachment-subtitle");

    $filename.text(data.text);
    $subtitle.text(data.size);

    $li.append($a.append($icon).append($filename).append($subtitle));
    $list.append($li);

    if ($list.hasClass("ui-listview")) {
        $list.listview("refresh");
    }
    // TODO remove inline style
    $a.css("padding",".4em 10px .4em 10px !important");
};

/**
 * reset all mailAttachments
 */
mox.mail.resetAttachments = function(data) {
    $("#mail-detail-attachment-list").empty().hide();
};

/**
 * draw attachment to a new mail
 */
mox.mail.drawAttachmentNewMail = function(data) {
    var $list = $("#newmail-attachment-list").show();
    var $li = $("<li>");
    var $a = $("<a>").attr("href","#");
    var $icon = $("<div>").addClass("attachment-icon");
    var $filename = $("<div>").addClass("attachment-filename");
    var $subtitle = $("<span>").addClass("attachment-subtitle");

    $filename.text(data.text);
    $subtitle.text(data.size);

    $li.append($a.append($icon).append($filename).append($subtitle));
    $list.append($li);

    if ($list.hasClass("ui-listview")) {
        $list.listview("refresh");
    }
    $a.css("padding", ".4em 10px .4em 10px !important");

};

/**
 * reset the attachment panel in new mail window
 */
mox.mail.resetAttachmentsNewMail = function(data) {
    $("#newmail-attachment-list").empty().hide();
};


/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2006-2011 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Stefan Preuss <stefan.preuss@open-xchange.com>
 */

// namespace for module settings
mox.settings = {
    
    appointments: {
        
        defaults: [
            { days: 7, text: _i18n("1 week") },
            { days: 14, text: _i18n("2 weeks") },
            { days: 30, text: _i18n("1 month") },
            { days: 60, text: _i18n("2 months") }
        ],
        
        getDefaultByDays: function(days) {
            for (var i=0; i < mox.settings.appointments.defaults.length; i++) {
                var obj = mox.settings.appointments.defaults[i];
                if (obj.days === days) {
                    return obj;
                }
            }
            return mox.settings.appointments.defaults[2];
        },
        
        numberOfDaysChanged: function(days) {
            var appDays = days,
                text = " ";
            if ($.isPlainObject(days) === false) {
                appDays = days = mox.settings.appointments.getDefaultByDays(
                        days ||  localUserConfig.appointmentDays || 7
                );
            }
            if (appDays && (appDays.text || appDays.value)) {
                text = format(_i18n("Appointments: %s"), (appDays.text || appDays.value)).toString();
            }
            $("#settings-app_days").text(text);
        }
    }
};

/**
 * Calculates the required days for 1 and 2 month so we can set the defaults
 */
mox.settings.appointments.initDefaults = function() {
    // 864e5 = 1 day in millis :)
    var dd = new Date();
    
    // 1 month
    mox.settings.appointments.defaults.push({
        days: getDaysInMonth(dd.getUTCMonth()+1, dd.getUTCFullYear()),
        text: _i18n("1 month").toString()
    });
    
    // 2 month
    dd.setUTCMonth(dd.getUTCMonth() + 1); // + 1 month
    mox.settings.appointments.defaults.push({
        days: getDaysInMonth(dd.getUTCMonth()+1, dd.getUTCFullYear()),
        text: _i18n("2 months").toString()
    });
};

$(events).bind("settings-calendar-appointmentDaysChanged", function(e, data) {
    mox.settings.appointments.numberOfDaysChanged({ 
        days: data.days,
        text: data.value
    });
});
/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2004-2010 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */


mox.login = {
    performRelogin  : false,
    clientId        : "client=" + mox.product.id + "&version=" + encodeURIComponent(mox.product.pversion),
    authID          : util.uuid(),
    failedLogins    : 0, // count the failed logins
    MAXFAILEDLOGINS : 3, // when do we show the password field as clear text
    easyLoginEnabled: false
};

mox.login.getData = mox.login.clientId + "&modules=true&authId=" + mox.login.authID;

/**
 * shows the password as clear text instead of hidden chars
 * @param  {boolean} state enabled or not
 */
mox.login.enableEasyPasswordField = function (state) {
    if (state && !mox.login.easyLoginEnabled) {
        mox.login.easyLoginEnabled = true;
        $('#form1').hide();
        $('#form2').show();
        $('#user2').val($('#user').val());
    }
    if (!state && mox.login.easyLoginEnabled) {
        mox.login.easyLoginEnabled = false;
        $('#form2').hide();
        $('#form1').show();
    }
};

/**
 * mox.login.loginAction
 * wrapper to do different login actions
 */
mox.login.loginAction = function() {
    _.debug("login.loginAction");
    /* pageloading */

    var keeploggedin = $("#stayloggedin").attr("checked");
    var user = mox.login.easyLoginEnabled ? $("#user2").val() : $("#user").val();
    var pass = mox.login.easyLoginEnabled ? $("#pass2").val() : $("#pass").val();
    if (!mox.login.performRelogin) {
        _.debug("login.loginAction performrelogin == false");
        mox.login.login( user, pass, keeploggedin, function() {
            $.mobile.changePage( "#home", { transition: transitions.slide } );
            /* pageloading */
        });
    } else {
        _.debug("login.loginAction performrelogin == true");
        mox.login.relogin($("#pass").val(), function() {
            mox.login.performRelogin = false;
        });
    }
};

/**
 * login
 * login to OX6 backend
 * @param {string} username
 * @param {string} pass
 * @param {boolean} saveCredentials
 * @param {function} callback to execute on success
 */
mox.login.login = function (username, pass, saveCredentials, callback) {
    _.debug("login.login", username, saveCredentials, callback);
    /* pageloading */
    // define loginData
    mox.login.loginData = {
        name: username
    };
    var loginHandler = function (data, response) {
        _.debug("login", data);
        if (data.error !== undefined) {

           mox.error.handleError(data);

        } else {

            loggedIn = true;

            // save session
            session = data.session;

            if (localUserConfig.username !== username) {
                localUserConfig.username = username;
                localUserConfig.subscribedFolders =  {
                    contacts: [],
                    mail: [],
                    calendar: []
                };
            }

            if (saveCredentials) {
                 $.ajax({
                    url: HOST + "/login?action=store&session=" + session,
                    success: function(data) {
                         if (data.error) {
                             mox.error.handleError(data);
                         }
                    },
                    type: "get",
                    error: $.noop,
                    dataType: "json"
                });
                localUserConfig.autoLogin = true;
            } else {
                localUserConfig.autoLogin = false;
            }

            localUserConfig.activeModules = {
                mail: data.modules.mail.module,
                calendar: data.modules.calendar.module,
                contacts: data.modules.contacts.module
            };

            if (storage.getMode() !== 0) {
                // there were changes in an previous offline session
                var change = storage.getItem("offlineChanges", true);
                if ( change === true ) {
                    mox.config.saveLocalUserConfig({
                        callback: mox.config.getUserConfig
                    });
                } else {
                     mox.config.getUserConfig();
                }
            } else {
                //get userconfigs and metadata
                mox.config.getUserConfig();
            }
            try {
                if (storage.getMode() !== 0) {
                    storage.flushStorage();
                    _.debug('flushStorage 2');
                }
            }
            catch (e) {
                mox.error.newError("[Storage] Error during flushing");
            }

            //callback execution after successful login
            if(callback && typeof(callback) === "function") {
                mox.login.enableEasyPasswordField(false); // disable easy login
                callback();
            }

        }
    };

    $.ajax({
        url: HOST + "/login?action=login&" + mox.login.getData ,
        data: {
            name: mox.login.loginData.name,
            password: pass
        },
        success: loginHandler,
        error: function(e) {
            // need for custom error handler
            if (isHybridApp) {
                try {
                    storage.setItem("SERVER_URL", "");
                } catch (e) {

                }
            }
            mox.error.handleError(e);
            },
        type: "post",
        dataType: "json",
        contentType: 'application/x-www-form-urlencoded; charset=UTF-8'
    });
};

/**
 * autologin function
 * try a autologin on backend and perfrom callback
 * on success
 * @param {object} callback
 * @param {boolean} saveCredentials
 */
mox.login.autoLogin = function (callback, saveCredentials) {
    _.debug("login.autologin", callback, saveCredentials);
    /* pageloading */
    var autoLoginHandler = function (data, response) {
        ///* pageloading */
        if (data.error === undefined) {
            // no error occurred

            session = data.session;
            // remove modal screen

            localUserConfig.autoLogin = true;
            loggedIn = true;

            localUserConfig.activeModules = {
                mail: data.modules.mail.module,
                calendar: data.modules.calendar.module,
                contacts: data.modules.contacts.module
            };

            if (saveCredentials || isHybridApp) {
                 $.ajax({
                    url: HOST + "/login?action=store&session=" + session,
                    success: eF,
                    type: "GET",
                    dataType: "json"
                });

                localUserConfig.autoLogin = true;

            }
            if ( storage.getItem("offlineChanges", true) === true ) {
                // OLD STUFF, we can send settings to server if some were
                // made during an previous offline session
                mox.config.saveLocalUserConfig({callback: mox.config.getUserConfig});
            } else {
                 //get userconfigs and metadata
                mox.config.getUserConfig();
            }

            if ( mox.login.actionAfterAutologin && (typeof(mox.login.actionAfterAutologin) === "function")) {
                mox.login.actionAfterAutologin();
            }
            $.mobile.changePage("#home", {transition: transitions.fade});

            if (typeof(callback) === "function") {
                callback({success: true, available: true});
            }

        } else if (data.code == "SVL-0003" || data.code == "SES-0205") {
            // auto login is turned on and autologin failed
            try {
                if (storage.getMode() !== 0) {
                    storage.flushStorage();
                    _.debug('flushStorage 3');
                }
            }
            catch (e) {
                mox.error.newError("[Storage] Error during flushing storage");
            }

            if (typeof(callback) === "function") {
                callback({success: false, available: true});
            }
        } else {

        	if (typeof(callback) === "function") {
                callback({success: false, available: true});
            }
            // remove save option on login page
            try {
                if (storage.getMode() !== 0) {
                    storage.flushStorage();
                    _.debug('flushStorage 3');
                }
            }
            catch (e) {
                mox.error.newError("[Storage] Error during flushing storage");
            }
            $("#stayloggedin").parent().remove();
        }
    };


    // form login
    if (formLoginSession) {

        // hide loading spinner after ajax finishes
        $("#home").ajaxStop(function() {
            /* pageloading */
        });
        // take session from form login object
        session = formLoginSession.session;

        // get modules config manually
        $.ajax({
            url: HOST + "/config/modules?session=" + session ,
            success: function(e) {
                if (e.error !== undefined) {
                    //mox.error.handleError(e);
                } else {

                    localUserConfig.activeModules = {
                        mail: e.data.mail.module,
                        calendar: e.data.calendar.module,
                        contacts: e.data.contacts.module
                    };

                    // autologin enabled?
                    if (formLoginSession.store === 'true') {
                        $.ajax({
                            url: HOST + "/login?action=store&session=" + session,
                            success: eF,
                            type: "GET",
                            dataType: "json"
                        });
                        localUserConfig.autoLogin = true;
                    }
                    // changes from offline mode to commit?
                    if ( storage.getItem("offlineChanges", true) === true ) {
                        mox.config.saveLocalUserConfig({callback: mox.config.getUserConfig});
                    } else {
                         //get userconfigs and metadata
                        mox.config.getUserConfig();
                    }
                    // now flush storage
                    try {
                        if (storage.getMode() !== 0) {
                            storage.flushStorage();
                            _.debug('flushStorage 4');
                        }
                    }
                    catch (e) {
                        //mox.error.newError("[Storage] Error during flushing");
                    }
                }
            },
            error: errorHandler,
            type: "get",
            dataType: "json"
        });


    // do autolgin on server
    } else {
        $.ajax({
            url: HOST + "/login?action=autologin&" + mox.login.getData,
            success: autoLoginHandler,
            error: function(e) {
                /* pageloading */
                $('#login').removeClass('ui-disabled');
            },
            type: "get",
            dataType: "json"
        });
    }
};


/**
 * DEPRECATED
 * quietLogin
 * does a login in background, i.e. for a relogin during work
 * @param {Object} options
 */
mox.login.quietLogin = function (options) {

    var defaults = {
        autoLogin: false,
        forceLoginPrompt: false,
        loginData: mox.login.loginData,
        success: function(e) {
            if (e.error === undefined) {
                session = e.session;
                loggedIn = true;
                if (defaults.autoLogin) {
                    $.ajax({
                        url: HOST + "/login?action=store&session=" + session,
                        success: eF,
                        type: "GET",
                        dataType: "json"
                    });
                }
            } else {
                mox.error.handleError(e);
            }
        },
        error: function(e) { mox.error.handleError(e); loggedIn = false; }

    };

    $.extend(defaults, options);

    if (defaults.loginData.name && defaults.loginData.password) {
        if (online) {
             $.ajax({
                url: HOST + "/login?action=login&" + mox.login.getData ,
                data: defaults.loginData,
                success: defaults.success,
                error: defaults.error,
                type: "post",
                dataType: "json"
         });
         }
     } else {
         ui.showAlertBox(_i18n("Your session expired.").toString(),
                 {
                     buttons: [
                     {
                         text: _i18n("Ok").toString(),
                         action: function() {
                             $.mobile.changePage("#login");
                         },
                         primary: true
                     }
                     ]
                 });
         }
};

/**
 * relogin
 * Perform a relogin after session expired
 * Disable changing the username to avoid data capture
 * @param pass
 * @param callback
 * perform a login after a session is expired and execute the callback
 */
mox.login.relogin = function(pass, callback) {
    _.debug("mox.login.relogin", pass, callback);
    /* pageloading */

    if (online) {

        $.ajax({
           url: HOST + "/login?action=login&" + mox.login.clientId,
           data: {
               name: localUserConfig.loginName,
               password: pass
           },
           success: function(e) {
               if (e.error) {
                   mox.error.handleError(e);
               } else {
                   // get session
                   session = e.session;
                   // restore last page
                   var lastPage = $.mobile.urlHistory.getPrev();

                   $.mobile.changePage("#" + lastPage.pageUrl, {transition: transitions.fade});

                   // cleanup
                   $("#reloginlabel").remove();
                   $("#relogin_cancel").parent().remove();
                   $("#user").removeAttr("readonly").val("").removeClass("ui-disabled");
                   callback();
               }
           },
           error: mox.error.handleError,
           type: "post",
           dataType: "json"
        });
    }
};


/**
 * initAfterLogin is called after mox.config.getUserConfig() has finished
 * loading user-configs from server
 * @return
 */
mox.login.initAfterLogin = function() {

    _.debug("login.initAfterLogin");
    localUserConfig.folderTree.contactFolders = [];

    mox.config.storeConfig();

    //call getFolders as entry
    mox.folder.getFolders();
};

/**
 * logout from backend
 */
mox.login.logout = function() {
    _.debug("logout");
    /* pageloading */
    var url = HOST + "/login";

    var successHandler = function(e) {
        ui.blockScreen(false);
        loggedIn = false;
        delete(window.session);
        /* pageloading */
        window.location.hash = ''; // remove jquery's hash
        window.location.reload();
    };

    var data = {
        "action": "logout",
        "session": session
    };

    if (online) {
        $.ajax({
            url: url,
            data: data,
            success: successHandler,
            error: function(e) {
                ui.blockScreen(false);
                /* pageloading */
                mox.error.handleError(e);
            },
            type: "get",
            dataType:"text"

        });
    } else {
        /* pageloading */
        //successHandler();
    }
};

mox.login.cancelRelogin = function() {
    window.location.reload();
};
