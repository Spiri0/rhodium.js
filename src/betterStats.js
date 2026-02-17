


export class Stat {
    constructor(name, defaultValue) {
        this.rowElement = document.createElement("tr");
        this.nameEntry = document.createElement("td");
        this.valueEntry = document.createElement("td");
        this.nameEntry.textContent = name;
        this.valueEntry.textContent = defaultValue;
        this.rowElement.append(this.nameEntry, this.valueEntry);
    }

    set value(value) {
        this.valueEntry.textContent = value;
    }
};


export class Stats2 {
    constructor(webgpuRenderer) {
        this.renderer = webgpuRenderer;
        this.domElement = document.createElement("table");
        this.domElement.style.backgroundColor = "#222222";
        this.domElement.style.color = "white";
        this.domElement.style.fontSize = "14px";
        this.domElement.style.fontFamily = "monospace";
        this.domElement.style.position = "absolute";
        this.domElement.style.top = "50px";
        this.domElement.style.right = "5px";
        this.domElement.style.right = "5px";
        this.domElement.style.borderRadius = "5px";
        this.domElement.style.border = "1px solid";
        this.stats = [];
        this.lastTime = 0;
        this.fps = 0;
        this.programsStat = new Stat("Programs", "0");
        this.geometriesStat = new Stat("Geometries", "0");
        this.texturesStat = new Stat("Textures", "0");
        this.callsStat = new Stat("Calls", "0");
        this.fpsStat = new Stat("FPS", "0");
        this.maxTriangles = new Stat("maxTriangles:", "0");
        this.trianglesStat = new Stat("Triangles", "0");
        this.pointsStat = new Stat("Points", "0");
        this.linesStat = new Stat("Lines", "0");
        //this.addStat(this.programsStat);
        //this.addStat(this.geometriesStat);
        //this.addStat(this.texturesStat);
        //this.addStat(this.callsStat);
        this.addStat(this.fpsStat);
        this.addStat(this.maxTriangles);
        this.addStat(this.trianglesStat);
        //this.addStat(this.pointsStat);
        //this.addStat(this.linesStat);
    }

    addStat(stat) {
        if (this.stats.indexOf(stat) !== -1)
        return;
        this.domElement.append(stat.rowElement);
    }

    update( renderer, custom ) {
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastTime;
        this.lastTime = currentTime;
        const currentFPS = Math.floor(1 / elapsed * 1e3);
        const alpha = 0.1;
        this.fps = (1 - alpha) * this.fps + alpha * currentFPS;
        //this.programsStat.value = 0;//this.renderer.info.programs.length.toString();
        //this.geometriesStat.value = 0;// this.renderer.info.memory.geometries.toString();
        //this.texturesStat.value = 0;// this.renderer.info.memory.textures.toString();
        //this.callsStat.value = 0;// this.renderer.info.render.calls.toString();
        this.fpsStat.value = this.fps.toFixed(0);
        this.maxTriangles.value = custom.maxTriangles.toString();
        this.trianglesStat.value = renderer.triangles.toString();
        //this.pointsStat.value = 0;// this.renderer.info.render.points.toString();
        //this.linesStat.value = 0;// this.renderer.info.render.lines.toString();
    }
};
