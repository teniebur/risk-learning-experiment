// For each experimenter's installation of mkturk, this contains information for dropbox keys, savepaths, stimuli
// Also used for liveplot to identify where to look for behavioral files

// ------ Dropbox WebApp settings ------ 
// PATH & APP KEY from Dropbox Developer Console for
// MKTURK.HTML & LIVEPLOT.HTML
// ------ Dropbox WebApp settings ------ 
var DBX_CLIENT_ID = "kjfmygfpzkpi5rk"
var DBX_REDIRECT_URI_ROOT = "https://eeemeric.github.io/risk-learning-experiment/"

// ------ Subject settings ------ 
var subjectlist = ["ExampleSubject"];

// ------ Save location settings ------
var DATA_SAVEPATH = "/mkturkfolders/datafiles/"
var PARAM_DIRPATH = "/mkturkfolders/parameterfiles/subjects/"
var SOUND_FILEPREFIX = "/mkturkfolders/sounds/au"

// ------ Misc. -----------------------
var ndatafiles2read=5; // todo: change to trials. and use as upper bound (stop reading once you hit the first discrepancy). maybe this is effectively synonymous with mintrials
var num_preload_images=0; // how long can you/the NHP bother waiting at each imageload? 400 images ~ 30 seconds. Recommended to keep = 0 with good internet connection and automator on










