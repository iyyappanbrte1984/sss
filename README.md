**Quick summary**
This project demonstrates a tiny vision inference pipeline: a TensorFlow.js image model (exported from Teachable Machine) runs in the phone's browser, classifies camera frames as **Fish** or **Trash**, and sends the label to a BBC micro:bit over **Web Bluetooth UART**. The micro:bit displays an icon and text for each label.
**Repository structure**
fish-trash-demo/
├─ index.html # Demo web page (loads model, camera, BLE)
├─ README.md # This file
└─ model/
├─ model.json
├─ group1-shard1of1.bin (or multiple .bin files)
└─ metadata.json

**How to prepare the model**
1. Use Teachable Machine (Image Project) to train two classes: `Fish` and `Trash`.
2. Export → **TensorFlow.js** → Download and unzip.
3. Put `model.json`, `*.bin` files and `metadata.json` inside the `model/` directory.
**How to deploy to GitHub Pages (web UI)**
1. Create a GitHub account and a **new repository** named `fish-trash-demo` (public).
2. On the repo page click **Add file → Upload files** and upload:
   - `index.html`
   - create a folder `model/` and upload `model.json`, `*.bin` files, and `metadata.json` into it.
3. Commit the upload.
4. Go to **Settings → Pages** and set the source to the `main` branch, `/ (root)` and Save.
5. Wait a minute; your site will be available at:
   `https://<your-username>.github.io/fish-trash-demo/`
**How to deploy using git (command line)**
```bash
# in your project folder
git init
git add .
git commit -m "Initial commit: add index.html and model files"
git branch -M main
# replace <YOUR-REPO-URL> with the URL from GitHub (e.g. https://github.com/you/fish-trash-demo.git)
git remote add origin <YOUR-REPO-URL>
git push -u origin main
Then enable GitHub Pages in the repo Settings (source = main / root).
How to test on your phone
1.	On your Android phone open Chrome and navigate to the GitHub Pages URL.
2.	Tap Start Camera → allow camera permission.
3.	Tap Connect micro:bit → pick the micro:bit device (name begins with BBC micro:bit).
4.	Hold a printed fish picture in front of the camera — the page should show Label: Fish and the micro:bit will display a happy face + the text Fish. For trash, micro:bit shows a sad face + Trash.
Micro:bit setup
•	Flash the micro:bit with the MakeCode program that starts a Bluetooth UART service and reads lines. Example code (MakeCode JavaScript):
bluetooth.startUartService();
basic.showString("BT READY");
bluetooth.onUartDataReceived("\n", function () {
    let incoming = bluetooth.uartReadUntil("\n").trim();
    if (incoming == "FISH") {
        basic.showIcon(IconNames.Happy);
        basic.showString("Fish");
    } else if (incoming == "TRASH") {
        basic.showIcon(IconNames.Sad);
        basic.showString("Trash");
    } else {
        basic.showString(incoming);
    }
})
