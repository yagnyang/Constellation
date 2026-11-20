export const STAR_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aBaseLum;
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform vec3 uCamPos;
  uniform float uStarBrightness;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vLum;
  varying float vSize;
  void main() {
    float dist = distance(position, uCamPos);
    float proximity = 1.0 - smoothstep(80.0, 900.0, dist);
    vColor = aColor;
    vAlpha = aAlpha;
    vLum = aBaseLum * mix(0.5, 1.2, proximity) * uStarBrightness;
    vSize = aSize;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Realistic pinpoint sizing
    gl_PointSize = clamp(aSize * mix(3.5, 6.5, proximity) * mix(0.85, 1.2, min(aBaseLum, 1.0)), 1.2, 7.5);
    gl_Position = projectionMatrix * mv;
  }
`;

export const STAR_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vLum;
  varying float vSize;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = exp(-d * d * 34.0);
    float halo = exp(-d * 6.5);
    float ax = abs(uv.x);
    float ay = abs(uv.y);
    float spike = (max(0.0, 1.0 - ax * 22.0) * max(0.0, 1.0 - ay * 3.5) +
                   max(0.0, 1.0 - ay * 22.0) * max(0.0, 1.0 - ax * 3.5)) * 0.5;
    vec3 hotColor = mix(vColor, vec3(1.0), core * 0.92);
    vec3 emission = hotColor * (core * 2.8 + halo * 1.2 + spike * 1.5) * vLum;
    float a = clamp(core * 1.0 + halo * 0.55 + spike * 0.75, 0.0, 1.0);
    gl_FragColor = vec4(emission, clamp(a * vAlpha, 0.0, 1.0));
  }
`;

export const ACTIVE_STAR_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ACTIVE_STAR_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) { 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i); 
    vec4 p = permute( permute( permute( 
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    float noise1 = snoise(vec3(vUv * 5.0, uTime * 0.2));
    float noise2 = snoise(vec3(vUv * 10.0, uTime * 0.3 + 10.0));
    float plasma = (noise1 + noise2) * 0.5;
    
    vec3 viewDir = normalize(-vPosition);
    float fresnel = dot(viewDir, vNormal);
    fresnel = max(0.0, fresnel);
    
    vec3 coreColor = mix(vec3(1.0), uColor, 0.4);
    vec3 edgeColor = uColor;
    
    vec3 finalColor = mix(edgeColor, coreColor, fresnel + plasma * 0.2);
    float alpha = fresnel * (0.8 + plasma * 0.2);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export const ACTIVE_STAR_GLOW_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ACTIVE_STAR_GLOW_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float dp = dot(vNormal, viewDir);
    float intensity = pow(max(0.0, dp), 2.0);
    float pulse = 1.0 + sin(uTime * 1.5) * 0.15;
    gl_FragColor = vec4(uColor, intensity * pulse * 0.5);
  }
`;
