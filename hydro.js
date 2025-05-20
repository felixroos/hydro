export let H = {};

// what follows is a trimmed down version of kabelsalat/core
class Node {
  constructor(type, value) {
    this.type = type;
    value !== undefined && (this.value = value);
    this.ins = [];
  }
}

function getNode(type, args, schema) {
  const next = new Node(type);
  next.schema = schema;
  next.ins = args.map((arg) => parseInput(arg, next));
  return next;
}

let register = (name, fn) => {
  Node.prototype[name] = function (...args) {
    return fn(this, ...args);
  };
  H[name] = fn;
  return fn;
};

let registerNode = (type, schema) =>
  register(type, (...args) => getNode(type, args, schema));

register("n", (value) => {
  if (typeof value === "object") {
    return value;
  }
  return new Node("n", value);
});

function parseInput(input, node) {
  // array = sequence of floats, function = value setter function
  if (Array.isArray(input) || typeof input === "function") {
    const floatNode = float();
    floatNode.value = input;
    return floatNode;
  }
  if (typeof input === "object") {
    return input;
  }
  if (typeof input === "number" && !isNaN(input)) {
    return H.n(input);
  }
  if (typeof input === "string") {
    return H.n(input);
  }
  console.log(
    `invalid input type "${typeof input}" for node of type "${
      node.type
    }", falling back to 0. The input was:`,
    input
  );
  return 0;
}

Node.prototype.apply = function (fn) {
  return fn(this);
};

Node.prototype.dfs = function (fn, visited) {
  return this.apply((node) => dfs(node, fn, visited));
};

let dfs = (node, fn, visited = []) => {
  node = fn(node, visited);
  visited.push(node);
  node.ins = node.ins.map((input) => {
    if (visited.includes(input)) {
      return input;
    }
    return dfs(input, fn, visited);
  });
  return node;
};

// sort nodes by dependencies
function topoSort(graph) {
  const sorted = [];
  const visited = new Set();
  function dfs(node) {
    if (!(node instanceof Node) || visited.has(node)) {
      return; // constant values or already visited nodes
    }
    visited.add(node);
    for (let i in node.ins) {
      dfs(node.ins[i]);
    }
    sorted.push(node);
  }
  dfs(graph);
  return sorted;
}

function compile(node, options = {}) {
  const { log = false, constType = "n", varPrefix = "n" } = options;
  log && console.log("compile", node);
  const nodes = topoSort(node);
  let lines = [];
  let v = (node) => {
    if (node.type !== constType) {
      const id = nodes.indexOf(node);
      return `${varPrefix}${id}`;
    }
    if (typeof node.value === "string") {
      return `"${node.value}"`;
    }
    return node.value;
  };
  for (let id in nodes) {
    const node = nodes[id];
    const vars = nodes[id].ins.map((inlet) => v(inlet));
    const meta = {
      vars,
      node,
      nodes,
      id,
      name: v(node),
    };
    if (node.schema && node.schema.compile) {
      lines.push(node.schema.compile(meta));
    }
  }

  const src = lines.join("\n");
  if (log) {
    console.log("compiled code:");
    console.log(src);
  }
  return { src };
}

Node.prototype.compile = function (options) {
  return compile(this, options);
};

//// Hydra specific logic

let glslNode = (functionName, schema) => {
  if (!schema.type) {
    throw new Error(`no "schema.type" set for node ${functionName}`);
  }
  if (!schema.args) {
    throw new Error(`no "schema.args" set for node ${functionName}`);
  }
  return register(functionName, (...args) =>
    getNode(functionName, schema.args(...args), {
      compile: ({ vars, name }) =>
        `${schema.type} ${name} = ${functionName}(${glslArgs(...vars)});`,
      ...schema,
    })
  );
};

let glslArgs = (...args) =>
  args
    .map((arg) => {
      if (isNaN(Number(arg))) {
        return arg;
      }
      if (Number.isInteger(Number(arg))) {
        return arg + ".";
      }
      return arg;
    })
    .join(", ");

registerNode("_st", {
  compile: ({ name }) => `vec2 ${name} = st;`,
});
H.st = H._st();

registerNode("_mouseX", {
  compile: ({ name }) => `float ${name} = iMouse.x;`,
});
H.mouseX = H._mouseX();
registerNode("_mouseY", {
  compile: ({ name }) => `float ${name} = iMouse.y;`,
});
H.mouseY = H._mouseY();

// SOURCES
H.o0 = 0;
H.o1 = 1;
H.o2 = 2;
H.o3 = 3;
H.toRender = H.o0;
H.render = (output = H.o0) => (H.toRender = output);

H._src = registerNode("src", {
  compile: ({ vars, name }) => {
    let tex = `tex${vars[1]}`;
    return `vec4 ${name} = src(${glslArgs(vars[0])},${tex});`;
  },
});
register("src", (tex = H.o0) => {
  if (typeof tex !== "number") {
    // this is to avoid error when doing src(s0) atm
    console.warn("src expects a number.. falling back to 0");
    tex = 0;
  }
  return H._src(st, tex);
});
// this allows using o0..o3 (=number) as texture inputs
let vec4 = (input) => (typeof input === "number" ? H.src(input) : input);

// this node is used to get a float in from the outside
// used for functions and sequences (Arrays)
registerNode("float", {
  compile: ({ vars, name, node }) => {
    const uniformName = `float${node.id}`;
    return `float ${name} = ${uniformName};`;
  },
});

registerNode("_osc", {
  compile: ({ vars, name }) => `vec4 ${name} = osc(${glslArgs(...vars)});`,
});
register("osc", (freq = 60, sync = 0.1, offset = 0) =>
  _osc(st, freq, sync, offset)
);

registerNode("_noise", {
  compile: ({ vars, name }) => `vec4 ${name} = noise(${glslArgs(...vars)});`,
});
register("noise", (scale = 10, offset = 0.1) => _noise(st, scale, offset));

registerNode("_voronoi", {
  compile: ({ vars, name }) => `vec4 ${name} = voronoi(${glslArgs(...vars)});`,
});
register("voronoi", (scale = 5, speed = 0.3, blending = 0.3) =>
  _voronoi(st, scale, speed, blending)
);

registerNode("_gradient", {
  compile: ({ vars, name }) => `vec4 ${name} = gradient(${glslArgs(...vars)});`,
});
register("gradient", (speed = 0) => _gradient(st, speed));

registerNode("_shape", {
  compile: ({ vars, name }) => `vec4 ${name} = shape(${glslArgs(...vars)});`,
});
register("shape", (sides = 3, radius = 0.3, smoothing = 0.01) =>
  _shape(st, sides, radius, smoothing)
);

registerNode("_solid", {
  compile: ({ vars, name }) => `vec4 ${name} = solid(${glslArgs(...vars)});`,
});
register("solid", (r = 0, g = 0, b = 0, a = 1) => H._solid(H.st, r, g, b, a));
let outputs = { [H.o0]: H.solid() };

// GEOMETRY

function editGeometry(input, fn) {
  // we need to edit all _st nodes in all parents
  input.dfs((node, visited) => {
    if (node.ins[0]?.type === "_st") {
      node.ins[0] = fn(node.ins[0]);
      visited.push(node.ins[0]); // prevents inifinite loop
    }
    return node;
  });
  return input;
}

registerNode("_rotate", {
  compile: ({ vars, name }) => `vec2 ${name} = rotate(${glslArgs(...vars)});`,
});
register("rotate", (input, angle = 10, speed = 0) =>
  editGeometry(input, (st) => st._rotate(angle, speed))
);

registerNode("_scale", {
  compile: ({ vars, name }) => `vec2 ${name} = scale(${glslArgs(...vars)});`,
});
register(
  "scale",
  (input, amount = 1.5, xMult = 1, yMult = 1, offsetX = 0.5, offsetY = 0.5) =>
    editGeometry(input, (st) =>
      st._scale(amount, xMult, yMult, offsetX, offsetY)
    )
);

registerNode("_pixelate", {
  compile: ({ vars, name }) => `vec2 ${name} = pixelate(${glslArgs(...vars)});`,
});
register("pixelate", (input, pixelX = 20, pixelY = 20) =>
  editGeometry(input, (st) => st._pixelate(pixelX, pixelY))
);

registerNode("_repeat", {
  compile: ({ vars, name }) => `vec2 ${name} = repeat(${glslArgs(...vars)});`,
});
register(
  "repeat",
  (input, repeatX = 3, repeatY = 3, offsetX = 0, offsetY = 0) =>
    editGeometry(input, (st) => st._repeat(repeatX, repeatY, offsetX, offsetY))
);

registerNode("_repeatX", {
  compile: ({ vars, name }) => `vec2 ${name} = repeatX(${glslArgs(...vars)});`,
});
register("repeatX", (input, reps = 3, offset = 0) =>
  editGeometry(input, (st) => st._repeatX(reps, offset))
);

registerNode("_repeatY", {
  compile: ({ vars, name }) => `vec2 ${name} = repeatY(${glslArgs(...vars)});`,
});
register("repeatY", (input, reps = 3, offset = 0) =>
  editGeometry(input, (st) => st._repeatY(reps, offset))
);

registerNode("_kaleid", {
  compile: ({ vars, name }) => `vec2 ${name} = kaleid(${glslArgs(...vars)});`,
});
register("kaleid", (input, nSides = 4) =>
  editGeometry(input, (st) => st._kaleid(nSides))
);

registerNode("_scroll", {
  compile: ({ vars, name }) => `vec2 ${name} = scroll(${glslArgs(...vars)});`,
});
register(
  "scroll",
  (input, scrollX = 0.5, scrollY = 0.5, speedX = 0, speedY = 0) =>
    editGeometry(input, (st) => st._scroll(scrollX, scrollY, speedX, speedY))
);

registerNode("_scrollX", {
  compile: ({ vars, name }) => `vec2 ${name} = scrollX(${glslArgs(...vars)});`,
});
register("scrollX", (input, scroll = 0.5, speed = 0) =>
  editGeometry(input, (st) => st._scrollX(scroll, speed))
);

registerNode("_scrollY", {
  compile: ({ vars, name }) => `vec2 ${name} = scrollY(${glslArgs(...vars)});`,
});
register("scrollY", (input, scroll = 0.5, speed = 0) =>
  editGeometry(input, (st) => st._scrollY(scroll, speed))
);

// Color

glslNode("posterize", {
  type: "vec4",
  args: (input, bins = 3, gamma = 0.6) => [vec4(input), bins, gamma],
});
glslNode("shift", {
  type: "vec4",
  args: (input, r = 0.5, g = 0, b = 0, a = 0) => [vec4(input), r, g, b, a],
});
glslNode("invert", {
  type: "vec4",
  args: (input, amount = 1) => [vec4(input), amount],
});
glslNode("contrast", {
  type: "vec4",
  args: (input, amount = 1.6) => [vec4(input), amount],
});
glslNode("brightness", {
  type: "vec4",
  args: (input, amount = 0.4) => [vec4(input), amount],
});
glslNode("luma", {
  type: "vec4",
  args: (input, threshold = 0.5, tolerance = 0.1) => [
    vec4(input),
    threshold,
    tolerance,
  ],
});
glslNode("thresh", {
  type: "vec4",
  args: (input, threshold = 0.5, tolerance = 0.04) => [
    vec4(input),
    threshold,
    tolerance,
  ],
});
glslNode("color", {
  type: "vec4",
  args: (input, r = 1, g = 1, b = 1, a = 1) => [vec4(input), r, g, b, a],
});
glslNode("saturate", {
  type: "vec4",
  args: (input, amount = 2) => [vec4(input), amount],
});
glslNode("hue", {
  type: "vec4",
  args: (input, hue = 0.4) => [vec4(input), hue],
});
glslNode("colorama", {
  type: "vec4",
  args: (input, amount = 0.005) => [vec4(input), amount],
});
glslNode("r", {
  type: "vec4",
  args: (input, scale = 1, offset = 0) => [vec4(input), scale, offset],
});
glslNode("g", {
  type: "vec4",
  args: (input, scale = 1, offset = 0) => [vec4(input), scale, offset],
});
glslNode("b", {
  type: "vec4",
  args: (input, scale = 1, offset = 0) => [vec4(input), scale, offset],
});
// clashes with audio object
/*glslNode("a", {
        type: "vec4",
        args: (input, scale = 1, offset = 0) => [vec4(input), scale, offset],
      }); */

// blend

glslNode("add", {
  type: "vec4",
  args: (input, texture, amount = 1) => [vec4(input), vec4(texture), amount],
});
glslNode("sub", {
  type: "vec4",
  args: (input, texture, amount = 1) => [vec4(input), vec4(texture), amount],
});
glslNode("layer", {
  type: "vec4",
  args: (input, texture) => [vec4(input), vec4(texture)],
});
glslNode("blend", {
  type: "vec4",
  args: (input, texture, amount = 0.5) => [vec4(input), vec4(texture), amount],
});
glslNode("mult", {
  type: "vec4",
  args: (input, texture, amount = 1) => [vec4(input), vec4(texture), amount],
});
glslNode("diff", {
  type: "vec4",
  args: (input, texture) => [vec4(input), vec4(texture)],
});
glslNode("mask", {
  type: "vec4",
  args: (input, texture) => [vec4(input), vec4(texture)],
});

// modulate

registerNode("_modulate", {
  compile: ({ vars, name }) => `vec2 ${name} = modulate(${glslArgs(...vars)});`,
});
register("modulate", (input, modulator, amount = 0.1) =>
  editGeometry(input, (st) => st._modulate(vec4(modulator), amount))
);

registerNode("_modulateRepeat", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulateRepeat(${glslArgs(...vars)});`,
});
register(
  "modulateRepeat",
  (input, texture, repeatX = 3, repeatY = 3, offsetX = 0.5, offsetY = 0.5) =>
    editGeometry(input, (st) =>
      st._modulateRepeat(vec4(texture), repeatX, repeatY, offsetX, offsetY)
    )
);

registerNode("_modulateRepeatX", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulateRepeatX(${glslArgs(...vars)});`,
});
register("modulateRepeatX", (input, texture, reps = 3, offset = 0.5) =>
  editGeometry(input, (st) => st._modulateRepeatX(vec4(texture), reps, offset))
);

registerNode("_modulateRepeatY", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulateRepeatY(${glslArgs(...vars)});`,
});
register("modulateRepeatY", (input, texture, reps = 3, offset = 0.5) =>
  editGeometry(input, (st) => st._modulateRepeatY(vec4(texture), reps, offset))
);

registerNode("_modulateKaleid", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulateKaleid(${glslArgs(...vars)});`,
});
register("modulateKaleid", (input, texture, nSides = 4) =>
  editGeometry(input, (st) => st._modulateKaleid(vec4(texture), nSides))
);

registerNode("_modulateScrollX", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulateScrollX(${glslArgs(...vars)});`,
});
register("modulateScrollX", (input, texture, scrollX = 0.5, speed = 0) =>
  editGeometry(input, (st) =>
    st._modulateScrollX(vec4(texture), scrollX, speed)
  )
);

registerNode("_modulateScrollY", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulateScrollY(${glslArgs(...vars)});`,
});
register("modulateScrollY", (input, texture, scrollY = 0.5, speed = 0) =>
  editGeometry(input, (st) =>
    st._modulateScrollY(vec4(texture), scrollY, speed)
  )
);

registerNode("_modulateScale", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulateScale(${glslArgs(...vars)});`,
});
register("modulateScale", (input, texture, multiple = 1, offset = 1) =>
  editGeometry(input, (st) =>
    st._modulateScale(vec4(texture), multiple, offset)
  )
);

registerNode("_modulatePixelate", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulatePixelate(${glslArgs(...vars)});`,
});
register("modulatePixelate", (input, texture, multiple = 10, offset = 13) =>
  editGeometry(input, (st) =>
    st._modulatePixelate(vec4(texture), multiple, offset)
  )
);

registerNode("_modulateRotate", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulateRotate(${glslArgs(...vars)});`,
});
register("modulateRotate", (input, texture, multiple = 1, offset = 0) =>
  editGeometry(input, (st) =>
    st._modulateRotate(vec4(texture), multiple, offset)
  )
);

registerNode("_modulateHue", {
  compile: ({ vars, name }) =>
    `vec2 ${name} = modulateHue(${glslArgs(...vars)});`,
});
register("modulateHue", (input, texture, amount = 1) =>
  editGeometry(input, (st) => st._modulateHue(vec4(texture), amount))
);

registerNode("draw", {
  compile: ({ vars, name }) => `fragColor = ${vars[0]};`,
});
registerNode("exit", { internal: true });

// global vars
H.programs = {}; // needs global var to reuse textures
H.then = 0; // last render callback time
H.time = 0; // time in seconds
H.mouse = { x: 0, y: 0 };
H.speed = 1;
H.bpm = 30;
// stub definition for audio object
H.a = {
  fft: [0, 0, 0, 0],
  setSmooth: () => {},
  setCutoff: () => {},
  setBins: () => {},
  setScale: () => {},
  hide: () => {},
  show: () => {},
};
// Array functions
function enhanceArray(method, fn) {
  Object.defineProperty(Array.prototype, method, {
    value: function (...args) {
      return fn(this, ...args);
    },
    enumerable: false,
    writable: false,
    configurable: false,
  });
}
enhanceArray("fast", (arr, speed = 1) => {
  arr._speed = speed;
  return arr;
});
enhanceArray("offset", (arr, offset = 0.5) => {
  arr._offset = offset % 1;
  return arr;
});
let remap = (num, in_min, in_max, out_min, out_max) => {
  return ((num - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
};
enhanceArray("fit", (arr, low = 0, high = 1) => {
  let lowest = Math.min(...arr);
  let highest = Math.max(...arr);
  var newArr = arr.map((num) => remap(num, lowest, highest, low, high));
  newArr._speed = arr._speed;
  newArr._smooth = arr._smooth;
  newArr._ease = arr._ease;
  return newArr;
});
enhanceArray("smooth", (arr, smooth = 1) => {
  arr._smooth = smooth;
  return arr;
});
// from https://gist.github.com/gre/1650294
let easing = {
  // no easing, no acceleration
  linear: (t) => t,
  // accelerating from zero velocity
  easeInQuad: (t) => t * t,
  // decelerating to zero velocity
  easeOutQuad: (t) => t * (2 - t),
  // acceleration until halfway, then deceleration
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  // accelerating from zero velocity
  easeInCubic: (t) => t * t * t,
  // decelerating to zero velocity
  easeOutCubic: (t) => --t * t * t + 1,
  // acceleration until halfway, then deceleration
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  // accelerating from zero velocity
  easeInQuart: (t) => t * t * t * t,
  // decelerating to zero velocity
  easeOutQuart: (t) => 1 - --t * t * t * t,
  // acceleration until halfway, then deceleration
  easeInOutQuart: (t) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
  // accelerating from zero velocity
  easeInQuint: (t) => t * t * t * t * t,
  // decelerating to zero velocity
  easeOutQuint: (t) => 1 + --t * t * t * t * t,
  // acceleration until halfway, then deceleration
  easeInOutQuint: (t) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,
  // sin shape
  sin: (t) => 1 + Math.sin(Math.PI * t - Math.PI / 2),
};
enhanceArray("ease", (arr, ease = "linear") => {
  arr._smooth = 1;
  if (typeof ease == "function") {
    arr._ease = ease;
  } else if (easing[ease]) {
    arr._ease = easing[ease];
  }
  return arr;
});

// synth settings (stub definitions)
H.update = () => console.warn("update function not implemented");
H.setResolution = () => console.warn("setResolution function not implemented");
H.hush = () => console.warn("hush function not implemented");
H.setFunction = () => console.warn("setFunction function not implemented");
let sourceStub = {
  initCam: () => console.warn("s0.initCam not implemented"),
};
H.s0 = sourceStub;
H.s1 = sourceStub;
H.s2 = sourceStub;
H.s3 = sourceStub;

// speed

// vertex shader
const vs = `
                attribute vec4 a_position;
                void main() {
                  gl_Position = a_position;
                }
              `;

// animation frame logic
let requestId;
function requestFrame(render) {
  if (!requestId) {
    requestId = requestAnimationFrame(render);
  }
}
function cancelFrame() {
  if (requestId) {
    cancelAnimationFrame(requestId);
    requestId = undefined;
  }
}

// find out which outputs are src'ed into this graph
function getUniforms(graph) {
  const uniforms = {};
  let floatCount = 0;
  graph.dfs((node) => {
    if (node.type === "src") {
      let id = node.ins[1].value;
      const name = `tex${id}`;
      const definition = `uniform sampler2D ${name};`;
      uniforms[name] = { definition, id, type: "tex" };
    }
    if (node.type === "float") {
      const id = floatCount++;
      node.id = id;
      const name = `float${id}`;
      const definition = `uniform float ${name};`;
      let type;
      if (Array.isArray(node.value)) {
        type = "sequence";
      } else if (typeof node.value === "function") {
        type = "fn";
      } else {
        throw new Error("unexpected value of float type");
      }
      uniforms[name] = {
        definition,
        id,
        type,
        value: node.value,
      };
    }
    return node;
  });
  return uniforms;
}
// compiles a kabelsalat graph into a fragment shader
function compileFragmentShader(graph, uniforms = {}, glslPrelude) {
  graph = draw(graph).exit();
  const unit = graph.compile();
  const sourceUniforms = Object.values(uniforms)
    .map(({ definition }) => definition)
    .join("\n");

  let precision = "highp";
  //let precision = "mediump";
  let head = `precision ${precision} float;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform float iTime;
${sourceUniforms}
`;

  // this should be shadertoy compatible
  let shadertoy = `${glslPrelude}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord.xy / iResolution.xy;
  vec2 st = vec2(uv.x, 1.0 - uv.y);   
  ${unit.src}
}`;
  // console.log(shadertoy);
  return `
${head}
${shadertoy}
void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}`;
}

// takes hydro code and outputs one shader for each output
let compileShaderPrograms = (gl, hydroCode, glslPrelude) => {
  // console.log(hydroCode);
  Node.prototype.out = function (output = H.o0) {
    outputs[output] = this;
  };
  new Function(hydroCode)();
  for (let output in outputs) {
    const uniforms = getUniforms(outputs[output]);
    const fs = compileFragmentShader(outputs[output], uniforms, glslPrelude);
    const program = createProgramFromSources(gl, [vs, fs]);
    programs[output] = new Pen(gl, program, output, uniforms);
  }
  // TODO: return each shader as a new class instance
  // console.log("shaders", shaders);
  return programs;
};

H.init = (canvas = H.canvas, glslPrelude) => {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "hydro";
    const pixelRatio = 1;
    const pixelated = 1;
    canvas.width = window.innerWidth * pixelRatio;
    canvas.height = window.innerHeight * pixelRatio;
    canvas.style =
      "pointer-events:none;width:100%;height:100%;position:fixed;top:0;left:0";
    pixelated && (canvas.style.imageRendering = "pixelated");
    document.body.prepend(canvas);
    let timeout;
    window.addEventListener("resize", () => {
      timeout && clearTimeout(timeout);
      timeout = setTimeout(() => {
        canvas.width = window.innerWidth * pixelRatio;
        canvas.height = window.innerHeight * pixelRatio;
      }, 200);
    });
  }
  H.canvas = canvas;
  H.glslPrelude =
    glslPrelude || fetch("./shaders.glsl").then((res) => res.text());
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  const gl = canvas.getContext("webgl");
  gl.viewport(0, 0, canvas.width, canvas.height);
  // mouse logic
  document.addEventListener("mousemove", (e) => {
    const { left, height, top } = canvas.getBoundingClientRect();
    mouse.x = e.clientX - left;
    mouse.y = height - (e.clientY - top) - 1;
  });
  H.gl = gl;
  H.width = canvas.width;
  H.height = canvas.height;
  Object.assign(globalThis, H);
  globalThis.H = H;
  H.ready = true;
};
H.evaluate = async (hydroCode, canvas) => {
  if (!H.ready) {
    H.init(canvas);
  }
  let glslPrelude = await H.glslPrelude;
  H.toRender = H.o0; // reset default output (in case you're removing "render" call)
  // fragment shader
  const pens = compileShaderPrograms(H.gl, hydroCode, glslPrelude);
  const pen = pens[H.toRender];

  function render(now) {
    requestId = undefined;
    now *= 0.001; // convert to seconds
    const elapsedTime = Math.min(now - then, 0.1);
    time += elapsedTime;
    then = now;

    for (let o in pens) {
      // console.log("render", o);
      pens[o].render(time, mouse.x, mouse.y);
    }

    gl.useProgram(pen.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestFrame(render);
  }

  cancelFrame();
  requestFrame(render);
};

class Pen {
  constructor(gl, program, id, uniforms) {
    this.gl = gl;
    this.id = id;
    this.uniforms = uniforms;
    this.program = program;
    this.texPing = programs[id] ? programs[id].texPing : makeTexture(gl);
    this.texPong = programs[id] ? programs[id].texPong : makeTexture(gl);

    this.positionLoc = gl.getAttribLocation(program, "a_position");
    this.resolutionLoc = gl.getUniformLocation(program, "iResolution");
    this.mouseLoc = gl.getUniformLocation(program, "iMouse");
    this.timeLoc = gl.getUniformLocation(program, "iTime");

    const vertices = new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0,
    ]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // set up feedback ping pong textures
    this.framebuffer = gl.createFramebuffer();
  }
  render(time, mouseX, mouseY) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    // set uniforms
    gl.uniform2f(this.resolutionLoc, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(this.timeLoc, time);
    gl.uniform2f(this.mouseLoc, mouseX, mouseY);
    // set uniforms of sourced textures

    // set values of dynamic uniforms
    for (let name in this.uniforms) {
      const uniform = this.uniforms[name];
      const loc = gl.getUniformLocation(this.program, name);
      if (uniform.type === "tex") {
        gl.uniform1i(loc, uniform.id);
      } else if (uniform.type === "sequence") {
        const arr = uniform.value;
        const speed = arr._speed ?? 1;
        const smooth = arr._smooth ?? 0;
        const offset = arr._offset || 0;
        let value;
        let index = time * speed * (bpm / 60) + offset;
        if (smooth !== 0) {
          let ease = arr._ease ? arr._ease : easing["linear"];
          let _index = index - smooth / 2;
          let currValue = arr[Math.floor(_index % arr.length)];
          let nextValue = arr[Math.floor((_index + 1) % arr.length)];
          let t = Math.min((_index % 1) / smooth, 1);
          value = ease(t) * (nextValue - currValue) + currValue;
        } else {
          value = arr[Math.floor(index % arr.length)];
        }
        gl.uniform1f(loc, value);
      } else if (uniform.type === "fn") {
        gl.uniform1f(loc, uniform.value({ time }));
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.texPing,
      0
    );
    // select texture of id
    gl.activeTexture(gl.TEXTURE0 + Number(this.id));
    gl.bindTexture(gl.TEXTURE_2D, this.texPong);
    // draw to texture
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // swap ping pong textures
    [this.texPing, this.texPong] = [this.texPong, this.texPing];
  }
}

// helpers

function makeTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.canvas.width, // added gl.
    gl.canvas.height, // added gl.
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

// the rest is boilerplate code, loosely based on https://webglfundamentals.org/webgl/resources/webgl-utils.js
/*
 * Copyright 2021 GFXFundamentals.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of GFXFundamentals. nor the names of his
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
function loadShader(gl, shaderSource, shaderType) {
  const shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    const lastError = gl.getShaderInfoLog(shader);
    console.error(
      "*** Error compiling shader '" +
        shader +
        "':" +
        lastError +
        `\n` +
        shaderSource
          .split("\n")
          .map((l, i) => `${i + 1}: ${l}`)
          .join("\n")
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgramFromSources(
  gl,
  shaderSources,
  opt_attribs,
  opt_locations
) {
  const shaders = [
    loadShader(gl, shaderSources[0], gl.VERTEX_SHADER),
    loadShader(gl, shaderSources[1], gl.FRAGMENT_SHADER),
  ];
  return createProgram(gl, shaders, opt_attribs, opt_locations);
}
function createProgram(gl, shaders, opt_attribs, opt_locations) {
  const program = gl.createProgram();
  shaders.forEach(function (shader) {
    gl.attachShader(program, shader);
  });
  if (opt_attribs) {
    opt_attribs.forEach(function (attrib, ndx) {
      gl.bindAttribLocation(
        program,
        opt_locations ? opt_locations[ndx] : ndx,
        attrib
      );
    });
  }
  gl.linkProgram(program);
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) {
    const lastError = gl.getProgramInfoLog(program);
    console.error("Error in program linking:" + lastError);
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
