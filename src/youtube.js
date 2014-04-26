/**
 * @fileoverview VideoJS-SWF - Custom Flash Player with HTML5-ish API
 * https://github.com/zencoder/video-js-swf
 * Not using setupTriggers. Using global onEvent func to distribute events
 */

/**
 * Flash Media Controller - Wrapper for fallback SWF API
 *
 * @param {vjs.Player} player
 * @param {Object=} options
 * @param {Function=} ready
 * @constructor
 */

videojs.Youtube = videojs.MediaTechController.extend({
  /** @constructor */
  init: function(player, options, ready){
    videojs.MediaTechController.call(this, player, options, ready);
    
    this.isSeeking = false;
    
    var source = options['source'],

        // Which element to embed in
        parentEl = options['parentEl'],

        // Create a temporary element to be replaced by swf object
        placeHolder = this.el_ = videojs.Component.prototype.createEl('div', { id: player.id() + '_temp_youtube' }),

        // Generate ID for swf object
        objId = player.id()+'_youtube_api',

        // Store player options in local var for optimization
        // TODO: switch to using player methods instead of options
        // e.g. player.autoplay();
        playerOptions = player.options_,

        // Merge default flashvars with ones passed in to init
        flashVars = videojs.obj.merge({

          // SWF Callback Functions
          'readyFunction': 'videojs.Youtube.onReady',
          'eventProxyFunction': 'videojs.Youtube.onEvent',
          'errorEventProxyFunction': 'videojs.Youtube.onError',

          // Player Settings
          'autoplay': playerOptions.autoplay,
          'preload': playerOptions.preload,
          'loop': playerOptions.loop,
          'muted': playerOptions.muted

        }, options['flashVars']),

        // Merge default parames with ones passed in
        params = videojs.obj.merge({
          'wmode': 'opaque', // Opaque is needed to overlay controls, but can affect playback performance
          'bgcolor': '#000000' // Using bgcolor prevents a white flash when the object is loading
        }, options['params']),

        // Merge default attributes with ones passed in
        attributes = videojs.obj.merge({
          'id': objId,
          'name': objId, // Both ID and Name needed or swf to identifty itself
          'data':'http://www.youtube.com/apiplayer?enablejsapi=1&version=3',
          'class': 'vjs-tech'
        }, options['attributes']),

        lastSeekTarget
    ;

    // If source was supplied pass as a flash var.
    if (source) {
      if (source.type && videojs.Youtube.isStreamingType(source.type)) {
          var parts = videojs.Youtube.streamToParts(source.src);
          flashVars['video_id'] = parts.stream;
          flashVars['playerapiid'] = objId;
      }
      else {
        //flashVars['src'] = encodeURIComponent(videojs.getAbsoluteURL(source.src));
        flashVars['src'] = source.src;
      }
    }

    this['setCurrentTime'] = function(time){
      lastSeekTarget = time;
      this.isSeeking = true;
      this.seekTo(time);
      this.isSeeking = false;
    };
    this['currentTime'] = function(time){
      // when seeking make the reported time keep up with the requested time
      // by reading the time we're seeking to
      if (this.isSeeking) {
        return lastSeekTarget;
      }
      var cc = this.getCurrentTime(objId);
      return cc;
    };

    // Add placeholder to player div
    videojs.insertFirst(placeHolder, parentEl);

    // Having issues with Flash reloading on certain page actions (hide/resize/fullscreen) in certain browsers
    // This allows resetting the playhead when we catch the reload
    if (options['startTime']) {
      this.ready(function(){
        this.load(objId);
        this.play(objId);
        this.currentTime(options['startTime']);
      });
    }

    // firefox doesn't bubble mousemove events to parent. videojs/video-js-swf#37
    // bugzilla bug: https://bugzilla.mozilla.org/show_bug.cgi?id=836786
    if (videojs.IS_FIREFOX) {
      this.ready(function(){
        videojs.on(this.el(), 'mousemove', videojs.bind(this, function(){
          // since it's a custom event, don't bubble higher than the player
          this.player().trigger({ 'type':'mousemove', 'bubbles': false });
        }));
      });
    }

    videojs.Youtube.embed(options['swf'], placeHolder, flashVars, params, attributes);
    
    
    if(!window.onYouTubePlayerReady)
	{				
		window.onYouTubePlayerReady = function(playerID){
			videojs.Youtube.onReady(playerID);
			document.getElementById(playerID).addEventListener('onStateChange','eventListener_'+playerID);
		};
	}
    
    window['eventListener_'+objId] = function(status){
    	
    	videojs.Youtube.onEvent(objId,status);
    	
    };
    
  }
});

videojs.Youtube.events = {
		  '-2':"loadStart",
		  '-1': 'loaded',
		  '0' : 'ended',
		  '1': 'playing',
		  '2': 'paused',
		  '3': 'waiting'
};

videojs.Youtube.prototype.dispose = function(){
  videojs.MediaTechController.prototype.dispose.call(this);
};

videojs.Youtube.prototype.play = function(){
	this.el_.playVideo();
	this.player_.trigger('play');
};

videojs.Youtube.prototype.pause = function(){
	console.log("paausing the video");
	this.el_.pauseVideo();
	this.player_.trigger('pause');
};

videojs.Youtube.prototype.paused = function(){
	var status = this.el_.getPlayerState();
	if(status==2){
		return true;
	}
	return false;
};

videojs.Youtube.prototype.duration = function(){
	return this.el_.getDuration();
};

videojs.Youtube.prototype.muted = function(){
	return this.el_.isMuted();
};

videojs.Youtube.prototype.buffered = function(){ 
	return this.el_.getVideoLoadedFraction(); 
};

videojs.Youtube.prototype.volume = function() {  
	var val = this.el_.getVolume();
	return val/100;
};

videojs.Youtube.prototype.setVolume = function(percentAsDecimal){
	this.el_.setVolume(percentAsDecimal*100);
    this.player_.trigger('volumechange');
};

videojs.Youtube.prototype.muted = function() { 
	return this.el_.isMuted(); 
};

videojs.Youtube.prototype.setMuted = function(muted) { 
	this.el_.mute();
};

videojs.Youtube.prototype.getCurrentTime = function(){ 
	return this.el_.getCurrentTime();
};

videojs.Youtube.prototype.seekTo = function(time){ 
	this.player_.trigger('seeking');
	this.el_.seekTo(time);
	this.player_.trigger('timeupdate');
	this.player_.trigger('seeked');
};

videojs.Youtube.prototype.src = function(src){
  if (src === undefined) {
    return this.currentSrc();
  }

  if (videojs.Youtube.isStreamingSrc(src)) {
    src = videojs.Youtube.streamToParts(src);
    this.setRtmpConnection(src.connection);
    this.setRtmpStream(src.stream);
  } else {
    // Make sure source URL is abosolute.
    src = videojs.getAbsoluteURL(src);
    var parts = videojs.Youtube.streamToParts(source.src);
    this.el_.loadVideoById(parts.stream, 5, "large");
  }

  // Currently the SWF doesn't autoplay if you load a source later.
  // e.g. Load player w/ no source, wait 2s, set src.
  if (this.player_.autoplay()) {
    var tech = this;
    setTimeout(function(){ tech.play(); }, 0);
  }
};

videojs.Youtube.prototype.currentSrc = function(){
  var src = this.el_.vjs_getProperty('currentSrc');
  // no src, check and see if RTMP
  if (src == null) {
    var connection = this.rtmpConnection(),
        stream = this.rtmpStream();

    if (connection && stream) {
      src = videojs.Youtube.streamFromParts(connection, stream);
    }
  }
  return src;
};

videojs.Youtube.prototype.load = function(){
  this.el_.loadVideoById("bHQqvYy5KYo", 5, "large");
};

videojs.Youtube.prototype.poster = function(){
  //this.el_.vjs_getProperty('poster');
};

videojs.Youtube.prototype.setPoster = function(){
  // poster images are not handled by the Flash tech so make this a no-op
};

/*videojs.Youtube.prototype.buffered = function(){
  return videojs.createTimeRange(0, this.el_.vjs_getProperty('buffered'));
};*/

videojs.Youtube.prototype.supportsFullScreen = function(){
  return false; // Flash does not allow fullscreen through javascript
};

videojs.Youtube.prototype.enterFullScreen = function(){
  return false;
};

videojs.Youtube.isSupported = function(){
  return videojs.Youtube.version()[0] >= 10;
};

videojs.Youtube.canPlaySource = function(srcObj){
  var type;

  if (!srcObj.type) {
    return '';
  }

  type = srcObj.type.replace(/;.*/,'').toLowerCase();
  if (type in videojs.Youtube.formats || type in videojs.Youtube.streamingFormats) {
    return 'maybe';
  }
};

videojs.Youtube.formats = {
  'video/youtube': 'YOUTUBE'
};

videojs.Youtube.streamingFormats = {
  'video/youtube': 'YOUTUBE'
};

videojs.Youtube['onReady'] = function(currSwf){
  var el = videojs.el(currSwf);
  // Get player from box
  // On firefox reloads, el might already have a player
  var player = el['player'] || el.parentNode['player'],
      tech = player.tech;

  // Reference player on tech element
  el['player'] = player;

  // Update reference to playback technology element
  tech.el_ = el;

  videojs.Youtube.checkReady(tech);
};

// The SWF isn't alwasy ready when it says it is. Sometimes the API functions still need to be added to the object.
// If it's not ready, we set a timeout to check again shortly.
videojs.Youtube.checkReady = function(tech){
  // Check if API property exists
  if (tech.el() || true) {
    // If so, tell tech it's ready
    tech.triggerReady();

  // Otherwise wait longer.
  } else {
    setTimeout(function(){
      videojs.Youtube.checkReady(tech);
    }, 10000);

  }
};

// Trigger events from the swf on the player
videojs.Youtube['onEvent'] = function(swfID, eventName){
  var ee = videojs.Youtube.events[eventName];
  if(ee!=undefined){
	  eventName = ee;
  }
  var player = videojs.el(swfID)['player'];
  player.trigger(eventName);
};

// Log errors from the swf
videojs.Youtube['onError'] = function(swfID, err){
  var player = videojs.el(swfID)['player'];
  player.trigger('error');
  videojs.log('Youtube Error', err, swfID);
};

// Flash Version Check
videojs.Youtube.version = function(){
  var version = '0,0,0';

  // IE
  try {
    version = new window.ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version').replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];

  // other browsers
  } catch(e) {
    try {
      if (navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin){
        version = (navigator.plugins['Shockwave Flash 2.0'] || navigator.plugins['Shockwave Flash']).description.replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];
      }
    } catch(err) {}
  }
  return version.split(',');
};

// Flash embedding method. Only used in non-iframe mode
videojs.Youtube.embed = function(swf, placeHolder, flashVars, params, attributes){
  var code = videojs.Youtube.getEmbedCode(swf, flashVars, params, attributes),

      // Get element by embedding code and retrieving created element
      obj = videojs.createEl('div', { innerHTML: code }).childNodes[0],

      par = placeHolder.parentNode
  ;

  placeHolder.parentNode.replaceChild(obj, placeHolder);

  // IE6 seems to have an issue where it won't initialize the swf object after injecting it.
  // This is a dumb fix
  var newObj = par.childNodes[0];
  setTimeout(function(){
    newObj.style.display = 'block';
  }, 1000);

  return obj;

};

videojs.Youtube.getEmbedCode = function(swf, flashVars, params, attributes){

  var objTag = '<object type="application/x-shockwave-flash"',
      flashVarsString = '',
      paramsString = '',
      attrsString = '';

  // Convert flash vars to string
  if (flashVars) {
    videojs.obj.each(flashVars, function(key, val){
      flashVarsString += (key + '=' + val + '&amp;');
    });
  }

  // Add swf, flashVars, and other default params
  params = videojs.obj.merge({
    'movie': swf,
    'flashvars': flashVarsString,
    'allowScriptAccess': 'always', // Required to talk to swf
    'allowNetworking': 'all' // All should be default, but having security issues.
  }, params);

  // Create param tags string
  videojs.obj.each(params, function(key, val){
    paramsString += '<param name="'+key+'" value="'+val+'" />';
  });

  attributes = videojs.obj.merge({
    // Add swf to attributes (need both for IE and Others to work)
    'data': swf,

    // Default to 100% width/height
    'width': '100%',
    'height': '100%'

  }, attributes);

  // Create Attributes string
  videojs.obj.each(attributes, function(key, val){
    attrsString += (key + '="' + val + '" ');
  });

  return objTag + attrsString + '>' + paramsString + '</object>';
};

videojs.Youtube.streamFromParts = function(connection, stream) {
  return connection + '&' + stream;
};

videojs.Youtube.streamToParts = function(src) {
	  var parts = {
	    connection: '',
	    stream: ''
	  };

	  if (! src) {
	    return parts;
	  }

	  parts.stream = src.match(/v=(.{11})/)[1];;

	  return parts;
};

videojs.Youtube.isStreamingType = function(srcType) {
	  return srcType in videojs.Youtube.streamingFormats;
};

// RTMP has four variations, any string starting
// with one of these protocols should be valid
videojs.Youtube.RTMP_RE = /^rtmp[set]?:\/\//i;

videojs.Youtube.isStreamingSrc = function(src) {
  return videojs.Flash.RTMP_RE.test(src);
};
