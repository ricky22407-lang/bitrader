
// This worker runs in a separate thread, immune to some main-thread throttling
self.onmessage = (e) => {
    if (e.data === 'START') {
        // High precision timer loop
        self.timerId = setInterval(() => {
            self.postMessage('TICK');
        }, 1000); // 1 second heartbeat
    } else if (e.data === 'STOP') {
        if (self.timerId) {
            clearInterval(self.timerId);
            self.timerId = null;
        }
    }
};
