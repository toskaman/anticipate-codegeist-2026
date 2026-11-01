# Forge Hello World

This project contains a Forge app written in Javascript that displays `Hello World!` in a global full page with Custom UI. 

See [developer.atlassian.com/platform/forge/](https://developer.atlassian.com/platform/forge) for documentation and tutorials explaining Forge.

See [Global full page](https://developer.atlassian.com/platform/forge/manifest-reference/modules/global-full-page/) for
information on how to use this module. 

## Requirements

See [Set up Forge](https://developer.atlassian.com/platform/forge/set-up-forge/) for instructions to get set up.

## Development

1. **Install top-level dependencies:**

   ```sh
   npm install
   ```

2. **Install frontend dependencies:**

   ```sh
   cd static/hello-world
   npm install
   ```

3. **Start the Vite dev server:**

   ```sh
   cd static/hello-world
   npm start
   ```

   This starts the Vite dev server on `http://localhost:3000` with hot module
   replacement (HMR).

4. **Start the Forge tunnel** (from the repo root, in a separate terminal):

   ```sh
   forge tunnel
   ```

   The tunnel proxies the frontend to the Vite dev server instead of the built files. 
   Edits to the frontend are reflected live via HMR — no rebuild or page reload needed.

   > **Note:** Opening `http://localhost:3000` directly will fail, because
   > `@forge/bridge` only works inside the Atlassian product. Always load the app
   > through the product page while tunneling. Tunneling Custom UI is only
   > supported in Chrome and Firefox. If you change `manifest.yml`, run
   > `forge deploy` so the tunnel picks up the change.

### Building for deploy

```sh
cd static/hello-world
npm run build     
```

### Quick deploy

- Deploy your app by running:
```
forge deploy
```

- Install your app in an Atlassian site by running:
```
forge install
```

### Notes
- Use the `forge deploy` command when you want to persist code changes.
- Use the `forge install` command when you want to install the app on a new site.
- Once the app is installed on a site, the site picks up the new app changes you deploy without needing to rerun the install command.

## Support

See [Get help](https://developer.atlassian.com/platform/forge/get-help/) for how to get help and provide feedback.
