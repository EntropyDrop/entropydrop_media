function buildPerformanceTimeline() {
  const cue = {"fleet": 0.0, "contact": 10.8, "workload": 18.7, "results": 27.799999999999997, "sync": 32.0, "resources": 42.3, "finish": 51.166666666666664, "hit": 15.638709677419357, "fleetCounts": 23.1, "finishText": 51.45666666666666, "total": 59.7};
  const tl = gsap.timeline({ paused: true });
  for (const [id,t] of [
    ['fleet',cue.fleet], ['contact',cue.contact], ['workload',cue.workload],
    ['results',cue.results], ['sync',cue.sync], ['resources',cue.resources], ['linked',cue.finish]
  ]) {
    tl.from('#' + id + '-scene header', { opacity:0, y:10, duration:.38, ease:'power2.out' }, t+.04);
  }
  tl.from('#fleet-scene aside, #flight', { opacity:0, duration:.4 }, cue.fleet+.08);
  tl.from('#contact-scene aside, #contact', { opacity:0, duration:.36 }, cue.contact+.08);
  tl.to('#contact-hit', { opacity:1, duration:.23 }, cue.hit);
  tl.from('#workload-one', { opacity:0, y:12, duration:.42 }, cue.workload+.08);
  tl.from('#workload-fleet, #workload-scene footer', { opacity:0, y:12, duration:.42 }, cue.fleetCounts);
  tl.from('.results-table', { opacity:0, y:12, duration:.36 }, cue.results+.15);
  tl.from('#resources-scene article', { opacity:0, y:12, duration:.42, stagger:.12 }, cue.resources+.15);
  tl.from('#sync-scene article', { opacity:0, y:12, duration:.42, stagger:.15 }, cue.sync+.12);
  tl.from('#linked-scene article', { opacity:0, y:12, duration:.42, stagger:.10 }, cue.finish+.15);
  tl.from('#linked-conclusion', { opacity:0, y:8, duration:.35 }, cue.finishText);
  return tl;
}
