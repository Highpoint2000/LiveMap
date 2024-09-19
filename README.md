# Live Map for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin shows the detected reception (PI code/station ID) in realtime on a map.

![image](https://github.com/user-attachments/assets/9730d4bc-2cc1-4834-8070-db2b71ad9850)



## v1.2a

- Insert close X at the top-right corner

## Installation notes:

1. 	Download the last repository as a zip
2.	Unpack the LiveMapPlugin.js and the LiveMap folder with the livemap.js into the web server plugins folder (..fm-dx-webserver-main\plugins)
3. 	Restart the server
4. 	Activate the plugin it in the settings

## Important notes: 

- In order to display the position correctly, your own coordinates must be entered in the web server!
- A first display occurs as soon as a first PI code has been detected. The display is further specified when a station ID is received and updated dynamically when changes occur.
- The position of the pop-up window can be changed by pressing the border and moving the window. By pressing and dragging the blue triangle in the lower right corner, the size of the window can be adjusted.

## History:

### v1.2

- Enlarged header with additional log information

### v1.1

- The position and size of the window is now variable
- Problems with using the web server button have been fixed

### v1.0

- first edition
