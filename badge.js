let markerDiv = document.createElement( 'div' );

markerDiv.id = 'siteMarker';
markerDiv.style.position = 'fixed';
markerDiv.style.top = '0';
markerDiv.style.left = '0';
markerDiv.style.width = '10%';
markerDiv.style.height = '1.3rem';
markerDiv.style.padding = 0;
markerDiv.style.zIndex = '9999';
markerDiv.style.display = 'flex';
markerDiv.style.alignItems = 'center';
markerDiv.style.justifyContent = 'center';
markerDiv.style.backgroundColor = 'red';
markerDiv.style.textAlign = 'center';
markerDiv.style.fontWeight = 'bold';
markerDiv.style.fontSize = '0.9rem';
markerDiv.style.fontFamily = 'sans-serif';
markerDiv.style.textTransform = 'uppercase';

markerDiv.textContent = label;

document.body.prepend( markerDiv );