# Live Map for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin displays the detected and neighboring broadcast stations in real time on a map and table..

![image](https://github.com/user-attachments/assets/2a7d78b5-c61c-4c62-9c7a-12d125e24a98)




## v2.1

- Design adjustments
- Added polarization to the frequency table
- link to the livestream player
- Frequency list can be hidden (red square)
- Clicking on the city displays all stations in the location
- direct selection of the frequency for the FM-DX web server

## Installation notes:

1. 	Download the last repository as a zip
2.	Unpack the LiveMapPlugin.js and the LiveMap folder with the livemap.js into the web server plugins folder (..fm-dx-webserver-main\plugins)
3. 	Restart the server
4. 	Activate the plugin it in the settings
5.	Read the LiveMapQuickGuide.pdf 

## Important notes: 

- In order to display the position correctly, your own coordinates must be entered in the web server!
- An initial display occurs as soon as a first PI code has been recognized. The display is further specified upon receipt of a station ID and updated dynamically as changes occur.
- The position of the pop-up window can be changed by pressing the edge and moving the window. You can resize the window by pressing and dragging the blue square in the bottom right corner.
- The frequency table can be shown and hidden using the red square.
- Clicking on the green player symbol opens the link to the live stream (FMSCAN login required).
- Clicking on the location shows all programs at the location, clicking again returns. The frequency displayed in the location list can be clicked directly.
  
## History:

### v2.0

- new layout
- Display of transmitters if no PI code is received
- Filter for distances (100, 250, 500, 750, 1000 km)
- TXPOS button for radius display around the transmitter position (details see LiveMapQuickGuide.pdf!)
- Implemented PI code verification

### v1.2a

- Insert close X at the top-right corner

### v1.2

- Enlarged header with additional log information

### v1.1

- The position and size of the window is now variable
- Problems with using the web server button have been fixed

### v1.0

- first edition
