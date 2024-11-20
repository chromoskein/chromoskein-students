self.onmessage = (event) => {
    let j = 0;
    for (let i = 0; i < 10000000000; i++) {
      j += i;
    }
    self.postMessage("Finished cycles");
};