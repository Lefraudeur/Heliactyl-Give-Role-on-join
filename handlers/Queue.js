class Queue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    addJob(job) {
        this.queue.push(job);
        if (!this.processing) {
            this.processQueue();
        }
    }

    processQueue() { // bumpQueue Renamed
        if (this.processing || this.queue.length === 0) return;

        const job = this.queue.shift();
        this.processing = true;

        const cb = () => {
            this.processing = false;
            this.processQueue();
        };

        job(cb);
    }
}

module.exports = Queue;
