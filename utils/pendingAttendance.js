const pendingResults = new Map();

const waitForAttendanceResult = (uid, timeoutMs = 30000) => new Promise((resolve) => {
    const timer = setTimeout(() => {
        pendingResults.delete(uid);
        resolve({
            status: 'Error',
            message: 'Attendance verification timed out'
        });
    }, timeoutMs);

    pendingResults.set(uid, { resolve, timer });
});

const resolveAttendanceResult = (uid, result) => {
    const pending = pendingResults.get(uid);
    if (!pending) return;

    clearTimeout(pending.timer);
    pendingResults.delete(uid);
    pending.resolve(result);
};

module.exports = { waitForAttendanceResult, resolveAttendanceResult };