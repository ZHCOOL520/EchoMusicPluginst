let cpuWorkers = [];
let gpuCanvas = null;
let gpuGl = null;
let gpuAnimFrame = null;
let isRunning = false;
let statusPanel = null;

var CPU_WORKER_CODE = [
  'let running = false;',
  'onmessage = function(e) {',
  '  if (e.data === "start") {',
  '    running = true;',
  '    stress();',
  '  } else if (e.data === "stop") {',
  '    running = false;',
  '  }',
  '};',
  'function stress() {',
  '  if (!running) return;',
  '  for (let iter = 0; iter < 5; iter++) {',
  '    let a = 0;',
  '    for (let i = 0; i < 2000000; i++) {',
  '      a += Math.sqrt(i) * Math.sin(i * 0.001);',
  '      a += Math.cos(i * 0.001) * Math.tan((i % 1000) + 0.001);',
  '      a += Math.pow(i % 100, 0.5) / (i + 1);',
  '    }',
  '  }',
  '  postMessage("done");',
  '  setTimeout(stress, 0);',
  '}'
].join('\n');

function createUI() {
  var old = document.getElementById('stress-panel');
  if (old) old.remove();

  var panel = document.createElement('div');
  panel.id = 'stress-panel';
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;color:#fff;padding:20px;border-radius:15px;font-family:Arial;z-index:999999;min-width:320px;box-shadow:0 0 30px rgba(0,0,0,0.8);';
  
  var titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;';
  
  var title = document.createElement('h3');
  title.style.cssText = 'margin:0;color:#e94560;font-size:18px;';
  title.textContent = '系统压力测试';
  titleRow.appendChild(title);
  
  var closeBtn = document.createElement('button');
  closeBtn.textContent = 'X';
  closeBtn.style.cssText = 'background:none;border:none;color:#999;font-size:18px;cursor:pointer;padding:0 5px;';
  closeBtn.onmouseenter = function() { closeBtn.style.color = '#fff'; };
  closeBtn.onmouseleave = function() { closeBtn.style.color = '#999'; };
  closeBtn.onclick = function() {
    var panel = document.getElementById('stress-panel');
    if (panel) panel.style.display = 'none';
    var fab = document.getElementById('stress-fab');
    if (fab) fab.style.display = 'block';
  };
  titleRow.appendChild(closeBtn);
  panel.appendChild(titleRow);
  
  var logDiv = document.createElement('div');
  logDiv.id = 'stress-log';
  logDiv.style.cssText = 'background:#16213e;padding:10px;border-radius:8px;margin-bottom:15px;font-size:12px;height:60px;overflow:hidden;';
  logDiv.innerHTML = '<div>就绪 - 点击按钮开始测试</div>';
  panel.appendChild(logDiv);
  
  var btnGrid = document.createElement('div');
  btnGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;';
  
  var cpuBtn = document.createElement('button');
  cpuBtn.textContent = 'CPU';
  cpuBtn.style.cssText = 'padding:12px;border:none;border-radius:8px;background:#0f3460;color:#fff;cursor:pointer;font-weight:bold;';
  cpuBtn.onclick = function() { startStress('cpu'); };
  btnGrid.appendChild(cpuBtn);
  
  var gpuBtn = document.createElement('button');
  gpuBtn.textContent = 'GPU';
  gpuBtn.style.cssText = 'padding:12px;border:none;border-radius:8px;background:#0f3460;color:#fff;cursor:pointer;font-weight:bold;';
  gpuBtn.onclick = function() { startStress('gpu'); };
  btnGrid.appendChild(gpuBtn);
  
  var netBtn = document.createElement('button');
  netBtn.textContent = '网络';
  netBtn.style.cssText = 'padding:12px;border:none;border-radius:8px;background:#0f3460;color:#fff;cursor:pointer;font-weight:bold;';
  netBtn.onclick = function() { startStress('net'); };
  btnGrid.appendChild(netBtn);
  
  panel.appendChild(btnGrid);
  
  var allBtn = document.createElement('button');
  allBtn.textContent = '启动全部';
  allBtn.style.cssText = 'width:100%;padding:15px;border:none;border-radius:8px;background:linear-gradient(135deg,#e94560,#c23152);color:#fff;cursor:pointer;font-weight:bold;font-size:16px;margin-bottom:8px;';
  allBtn.onclick = function() { startStress('all'); };
  panel.appendChild(allBtn);
  
  var stopBtn = document.createElement('button');
  stopBtn.textContent = '停止';
  stopBtn.style.cssText = 'width:100%;padding:12px;border:none;border-radius:8px;background:#533483;color:#fff;cursor:pointer;font-weight:bold;';
  stopBtn.onclick = function() { stopAll(); };
  panel.appendChild(stopBtn);
  
  // 拖拽功能
  var isDragging = false;
  var dragX = 0;
  var dragY = 0;
  panel.onmousedown = function(e) {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragX = e.clientX - panel.offsetLeft;
    dragY = e.clientY - panel.offsetTop;
  };
  document.onmousemove = function(e) {
    if (!isDragging) return;
    panel.style.left = (e.clientX - dragX) + 'px';
    panel.style.top = (e.clientY - dragY) + 'px';
    panel.style.transform = 'none';
  };
  document.onmouseup = function() { isDragging = false; };
  
  document.body.appendChild(panel);
  statusPanel = panel;
  
  // 浮动按钮（面板隐藏时显示）
  var fab = document.createElement('button');
  fab.id = 'stress-fab';
  fab.textContent = '压力测试';
  fab.style.cssText = 'position:fixed;bottom:80px;right:20px;background:#e94560;color:#fff;border:none;border-radius:20px;padding:8px 16px;cursor:pointer;z-index:999999;font-size:12px;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:none;';
  fab.onclick = function() { panel.style.display = 'block'; fab.style.display = 'none'; };
  document.body.appendChild(fab);
}

function log(msg) {
  var el = document.getElementById('stress-log');
  if (el) {
    var time = new Date().toLocaleTimeString();
    el.innerHTML = '<div style="color:#00d2ff;">[' + time + '] ' + msg + '</div>' + el.innerHTML;
  }
}

function startCpuStress() {
  var cores = navigator.hardwareConcurrency || 8;
  log('CPU: 启动 ' + cores + ' 个Worker');
  
  for (var i = 0; i < cores; i++) {
    var blob = new Blob([CPU_WORKER_CODE], {type: 'application/javascript'});
    var worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = function() {};
    worker.postMessage('start');
    cpuWorkers.push(worker);
  }
  
  function mainThreadStress() {
    if (!isRunning) return;
    var x = 0;
    for (var i = 0; i < 3000000; i++) {
      x += Math.sin(i) * Math.cos(i);
    }
    requestAnimationFrame(mainThreadStress);
  }
  mainThreadStress();
  
  log('CPU: 运行中');
}

function startGpuStress() {
  log('GPU: 初始化高负载渲染...');
  
  // 创建多个Canvas增加GPU负载
  for (var c = 0; c < 3; c++) {
    var canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    canvas.style.cssText = 'position:fixed;top:' + (c * 10) + 'px;left:' + (c * 10) + 'px;width:50vw;height:50vh;z-index:999998;pointer-events:none;opacity:0.1;';
    document.body.appendChild(canvas);
    
    var gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    
    if (c === 0) {
      gpuCanvas = canvas;
      gpuGl = gl;
    }
    
    if (!gl) continue;
    
    var vsSrc = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';
    
    // 极度复杂的着色器
    var fsSrc = [
      'precision highp float;',
      'uniform float t;',
      'uniform vec2 r;',
      '',
      'float hash21(vec2 p){',
      '  p=fract(p*vec2(234.34,435.345));',
      '  p+=dot(p,p+34.23);',
      '  return fract(p.x*p.y);',
      '}',
      '',
      'float noise(vec2 p){',
      '  vec2 i=floor(p);',
      '  vec2 f=fract(p);',
      '  f=f*f*(3.0-2.0*f);',
      '  float a=hash21(i);',
      '  float b=hash21(i+vec2(1,0));',
      '  float c=hash21(i+vec2(0,1));',
      '  float d=hash21(i+vec2(1,1));',
      '  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);',
      '}',
      '',
      'float fbm(vec2 p){',
      '  float v=0.0;',
      '  float a=0.5;',
      '  vec2 shift=vec2(100.0);',
      '  mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));',
      '  for(int i=0;i<16;i++){',
      '    v+=a*noise(p);',
      '    p=rot*p*2.0+shift;',
      '    a*=0.5;',
      '  }',
      '  return v;',
      '}',
      '',
      'void main(){',
      '  vec2 uv=gl_FragCoord.xy/r;',
      '  vec2 q=uv;',
      '  float f=fbm(q*4.0+t*0.3);',
      '  vec3 col=vec3(0.0);',
      '  col=mix(vec3(0.1,0.2,0.4),vec3(0.8,0.3,0.2),f);',
      '  col=mix(col,vec3(0.2,0.6,0.9),fbm(q*8.0+t*0.5));',
      '  col*=1.5+0.5*sin(f*6.28+t);',
      '  for(int i=0;i<8;i++){',
      '    float fi=float(i);',
      '    vec2 p=q+vec2(sin(t*0.2+fi*0.7),cos(t*0.3+fi*0.5))*0.3;',
      '    col+=0.1/(0.01+length(p-0.5));',
      '  }',
      '  col=1.0-exp(-col*2.0);',
      '  gl_FragColor=vec4(col,1);',
      '}'
    ].join('\n');
    
    function makeShader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    
    var program = gl.createProgram();
    gl.attachShader(program, makeShader(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(program, makeShader(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(program);
    gl.useProgram(program);
    
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    
    var posLoc = gl.getAttribLocation(program, 'a');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    
    (function(gl, canvas, program) {
      function render() {
        if (!isRunning) return;
        var time = Date.now() / 1000;
        
        var tLoc = gl.getUniformLocation(program, 't');
        var rLoc = gl.getUniformLocation(program, 'r');
        gl.uniform1f(tLoc, time);
        gl.uniform2f(rLoc, canvas.width, canvas.height);
        
        // 50次绘制调用
        for (var i = 0; i < 50; i++) {
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        
        requestAnimationFrame(render);
      }
      render();
    })(gl, canvas, program);
  }
  
  log('GPU: 3个Canvas x 50次绘制/帧');
}

function startNetworkStress() {
  log('网络: 启动50个并发连接...');
  
  // 上传压力
  function doUpload() {
    if (!isRunning) return;
    var xhr = new XMLHttpRequest();
    xhr.onload = function() { if (isRunning) setTimeout(doUpload, 5); };
    xhr.onerror = function() { if (isRunning) setTimeout(doUpload, 50); };
    xhr.open('POST', 'https://httpbin.org/post', true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    // 发送5MB数据
    xhr.send(new ArrayBuffer(5 * 1024 * 1024));
  }
  
  // 下载压力
  function doDownload() {
    if (!isRunning) return;
    var xhr = new XMLHttpRequest();
    xhr.onload = function() { if (isRunning) setTimeout(doDownload, 5); };
    xhr.onerror = function() { if (isRunning) setTimeout(doDownload, 50); };
    xhr.open('GET', 'https://httpbin.org/bytes/10485760', true); // 10MB
    xhr.send();
  }
  
  // 25个上传 + 25个下载
  for (var i = 0; i < 25; i++) {
    doUpload();
    doDownload();
  }
  
  log('网络: 50个连接 (25上行+25下行)');
}

function startStress(type) {
  isRunning = true;
  
  if (type === 'cpu' || type === 'all') startCpuStress();
  if (type === 'gpu' || type === 'all') startGpuStress();
  if (type === 'net' || type === 'all') startNetworkStress();
  
  log('启动: ' + (type === 'all' ? '全部' : type.toUpperCase()));
}

function stopAll() {
  isRunning = false;
  
  for (var i = 0; i < cpuWorkers.length; i++) {
    try { cpuWorkers[i].postMessage('stop'); cpuWorkers[i].terminate(); } catch(e) {}
  }
  cpuWorkers = [];
  
  // 清理所有WebGL canvas
  var canvases = document.querySelectorAll('[style*="z-index:999998"]');
  for (var j = 0; j < canvases.length; j++) {
    var c = canvases[j];
    var g = c.getContext('webgl');
    if (g) {
      var ext = g.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    c.remove();
  }
  gpuCanvas = null;
  gpuGl = null;
  gpuAnimFrame = null;
  
  log('全部已停止');
}

export function activate(ctx) {
  createUI();
  log('插件已激活');
}

export function deactivate(ctx) {
  stopAll();
  var panel = document.getElementById('stress-panel');
  if (panel) panel.remove();
  var fab = document.getElementById('stress-fab');
  if (fab) fab.remove();
}