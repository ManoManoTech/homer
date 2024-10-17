# Plugin System for Custom Release Manager

## Introduction

This document provides instructions on how to use the plugin system to add your own release manager to the Homer project.
You can create a project containing a `plugins/release` directory which will contain your release manager and build a new Docker image where `plugins/release` will be copied to `dist/plugins`.

## Steps to Add a Custom Release Manager

1. **Create a New Release Manager**

   - Navigate to the `plugins/release` directory in your Homer project.
   - Create `myOwnReleaseManager.js` and implement the logic(for now the types are not available as a standalone package but you can have the interface [here](./src/release/typings/ReleaseManager.ts)).
   - You have an implementation example with [defaultReleaseManager](./plugins/release/defaultReleaseManager.ts)

2. **Register the Plugin**

   - If you have a project which needs the custom release manager, declare the project in the configuration [file](./config/homer/projects.json)
   - Add an entry for your project (the name of the release manager must correspond to its file name).
     ```json
     {
       "description": "project_example",
       "notificationChannelIds": ["C0XXXXXXXXX"],
       "projectId": 1234,
       "releaseChannelId": "C0XXXXXXXXX",
       "releaseManager": "myOwnReleaseManager",
       "releaseTagManager": "stableDateReleaseTagManager"
     }
     ```

3. **Deploy**
   - Build the plugins and config with Homer project before deploying the application.

## Conclusion

By following these steps, you can extend the Homer project with your own custom release manager using the plugin system.
Please only **add your own release managers or managers from trusted sources** to minimize security breaches in your Homer Slack application.
