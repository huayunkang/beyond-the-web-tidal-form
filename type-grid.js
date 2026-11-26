/*! Codrops · TextCharacterAnimations / Caustics, ac0fe97a4e4f786ef5d514d7030b6eb5855da05b, MIT; licenses/TextCharacterAnimations.MIT.txt.
 * Original six waves, slope, curvature Hessian, inverse ray and Jacobian gather; host supplies live flow intensity, output coordinates relative to the atlas. */
window.EditionTypes=Object.freeze({causticGLSL:`
const int WAVES = 6;
const vec2 DIRECTION[WAVES] = vec2[WAVES](vec2(0.9394, 0.3429), vec2(0.3153, 0.9490), vec2(-0.4611, 0.8874), vec2(-0.9710, 0.2392), vec2(-0.6907, -0.7232), vec2(0.3780, -0.9258));
const float NUMBER[WAVES] = float[WAVES](4.8332, 6.2832, 7.3920, 8.7266, 10.1342, 11.4240);
const float SPEED[WAVES] = float[WAVES](3.0778, 3.5093, 3.8063, 4.1357, 4.4568, 4.7319);
const float OFFSET[WAVES] = float[WAVES](0.0000, 2.1000, 4.4000, 1.3000, 5.6000, 3.7000);
const float SOFTEN = .45;
vec2 slope(vec2 q, float tau, float uFontSize) {
    vec2 g = vec2(0.0);
    for (int i = 0; i < WAVES; i++) {
        float phase = NUMBER[i] / uFontSize * dot(DIRECTION[i], q) - SPEED[i] * tau + OFFSET[i];
        g += DIRECTION[i] * cos(phase);
    }
    return g / sqrt(float(WAVES));
}

// How the surface curves at q: its second derivatives xx, yy and xy, per px
vec3 bend(vec2 q, float tau, float uFontSize) {
    vec3 c = vec3(0.0);
    for (int i = 0; i < WAVES; i++) {
        float n = NUMBER[i] / uFontSize;
        float phase = n * dot(DIRECTION[i], q) - SPEED[i] * tau + OFFSET[i];
        vec2 d = DIRECTION[i];
        c -= n * sin(phase) * vec3(d.x * d.x, d.y * d.y, d.x * d.y);
    }
    return c / sqrt(float(WAVES));
}
vec3 editionCaustic(vec2 p, float tau, float uFontSize, float intensity){
    float k = .28 * uFontSize * clamp(intensity,0.,1.);
    vec2 q = p - k * slope(p, tau, uFontSize);
    q = p - k * slope(q, tau, uFontSize);

    // How much the surface gathers that light here, or spreads it thin
    vec3 c = bend(q, tau, uFontSize);
    float det = (1.0 + k * c.x) * (1.0 + k * c.y) - k * k * c.z * c.z;
    float gather = sqrt(1.0 + SOFTEN * SOFTEN) / sqrt(det * det + SOFTEN * SOFTEN);
    return vec3(q-p,min(gather,1.15));
}
`});
