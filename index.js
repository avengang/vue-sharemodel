var fs = require("fs");
var loaderUtils = require("loader-utils");
var storeKeys = [];
var first = false;

module.exports = function(source) {
	
	var reg = /@store.(\w+)/gm;
	var r = source.match(reg);
	
	if(!r) {
		return source;
	}
	var cpath = __dirname.replace("\\node_modules\\vue-storescanner-loader", "");
	var componentPath = this.resourcePath.replace(cpath, "").replace(/\\/g, "_")
		.replace(/\//g, "_").replace(".vue", "");
	var options = loaderUtils.getOptions(this);
  	source = dealSource(source, componentPath);
	var storeStr = "window._storeObj = function() {}\n window.__storeObj = {};\n";
	
	for(var i=0,ii=storeKeys.length;i<ii;i++) {
		storeStr += "Object.defineProperty(window._storeObj, '"+storeKeys[i]
		+"', {\n set: function(v) {\n "
						+"for(var i=0;i<window._storeListeners.length;i++) {\n "
							+"if(window._storeListeners[i]) {\n"
								+"window.__storeObj."+storeKeys[i]+" = v;\n "
								+"window._storeListeners[i](v, '"+storeKeys[i]+"');\n"
							+"} else {\n"
								+"window._storeListeners.splice(i, 1);\n"
							+"}"
						+"}\n"
					+"}\n"
				+"});\n";
	}
	
	var filename = (options && options.filename) ? options.filename : "store";
	filename = filename.replace(".js", "");
	filename += ".js";
	var resourcePath = this.resourcePath;
	
	if(!first) {
console.log(resourcePath.split("\\src")[0]+"/src/"+filename);
		first = true;
	}
	fs.writeFileSync(resourcePath.split("\\src")[0]+"/src/"+filename, storeStr, "utf-8");
	var data = fs.readFileSync(resourcePath.split("\\src")[0]+"/src/main.js", "utf-8");
	data = data.replace("import'./"+filename+"'\n", "");
	data = "import'./"+filename+"'\n" + data;
	fs.writeFileSync(resourcePath.split("\\src")[0]+"/src/main.js", data, "utf-8");
  	return source;
};
function dealSource(source, componentPath) {
	var reg = /@store.(\w+)/gm;
	var r = source.match(reg);
	
	if(r) {
		
		for(var i=0,ii=r.length;i<ii;i++) {
			var str = r[i].replace("@store.", "");
			if(!str) continue;
			
			if(storeKeys.indexOf(str) == -1) {
				storeKeys.push(str);
			}
		}
	}
	var reg2 = /data[\s]*\([\s]*\)[\s]*[\n]*[\s]*{[\s]*[\n]*[\s]*return[\s]*[\n]*[\s]*\{/gm;
	var storeDataStr = "";
	
	for(i=0,ii=storeKeys.length;i<ii;i++) {
		storeDataStr += storeKeys[i] + ":window.__storeObj."+storeKeys[i]+",\n";
	}
	var template = source.split("<template>")[1].split("</template>")[0];
	var script = source.split("<script>")[1].split("</script>")[0];
	var style = source.split("<style")[1].split("</style>")[0];
	template = template.replace(/@store./gm, "");
	
	if(script.replace(/\s/gm, "").replace(/\n/gm, "").indexOf("data(){return{") == -1) {
		script = script.replace(/export[\s]*default[\s]*{/gm, "export default {\n data() { \n return{\n"
			+storeDataStr+"componentPath: '"+componentPath+"'\n}\n},\n");
	} else {
		script = script.replace(reg2, "data() {\n return {\n " + storeDataStr + "componentPath: '"+componentPath+"',\n");
	}
	var listeners = "function _storeListener(v, k) {\n";
	
	for(i=0,ii=storeKeys.length;i<ii;i++) {
		listeners += "if(k=='"+storeKeys[i]+"') "+componentPath + "_this." + storeKeys[i] + "=v;\n";		
	}
	listeners += "}\n if(!window._storeListeners) {\n window._storeListeners = [];\n}\n"
		+ "window._storeListeners.push(_storeListener);\n";
		
	if(script.replace(/\s/gm, "").replace(/\n/gm, "").indexOf(/created[\s]*[\n]*[\s]*\([\s]*\)[\s]*[\n]*[\s]*{[\s]*[\n]*[\s]*return[\s]*[\n]*[\s]*{/) == -1) {
		script = script.replace(/export[\s]*default[\s]*[\n]*[\s]*{/gm, "export default {\n created() {"
			+ componentPath + "_this = this;\n "+listeners + "\n},\n");
	} else {
		script = script.replace(/created[\s]*[\n]*[\s]*\([\s]*\)[\s]*[\n]*[\s]*{/gm,
			"created() {\n "+componentPath + "_this = this;\n "+listeners+"\n");
	}
	script = "var " + componentPath + "_this = null;\n" + script;
	var storeReg = /@store.([^;]*;)/gm;
	var storeR = script.match(storeReg);
	
	if(storeR) {
		
		for(i=0,ii=storeR.length;i<ii;i++) {
			var str = storeR[i].replace("@store.", "");
			script = script.replace(storeR[i], "\n window._storeObj." + str);
		}
	}
	source = "<template>" + template + "</template>" + "<script>" + script + "</script>" + "<style" + style + "</style>";
	return source;
}
