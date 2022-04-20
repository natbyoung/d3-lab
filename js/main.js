/* By Natalie Young, Spring 2022
I heavily referenced the example of https://sgrandstrand.github.io/Geog575Lab2/ and https://github.com/sgrandstrand/D3CoordinatedViz(thank you!)
I have updated these examples with my own work.

Assignment Goal: Choropleth Map & Linked Bar Chart, Displaying at Least 5 Data Attributes

Notes: census tracts from Census Bureau shapefile (2020 tracts for snohomish county), simplified to 2.5% on mapshaper.
The visualization displays 110 of 175 census tracts in the county.
ACS data were downloaded via data.census.gov advanced search.*/

(function () {
	
	//pseudo-global variables
    var attrArray = ["less_grade_9", "bach", "grad", "hs_or_higher", "bach_or_higher"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.45,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 5,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";


    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scale.linear()
        .range([463, 0])
        .domain([0, 100]);

    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap() {

        //map frame dimensions
        var width = window.innerWidth * 0.42,
            height = 460;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);
			
		//create Albers equal area conic projection centered on USA - this also works, but zoomed too far out
		var projection = d3.geo.mercator()
			.center([-122.2,47.89])
			.scale(65000)
			.translate([width / 2, height / 2]);

        var path = d3.geoPath()
            .projection(projection);
			
        //use queue to parallelize asynchronous data loading
        d3.queue()
            .defer(d3.csv, "data/selected_tract_data_education.csv") //load attributes from csv
            .defer(d3.json, "data/tl_2020_us_county_WAstate.topojson") //load background spatial data
            .defer(d3.json, "data/selected_snohomish_tracts.topojson") //load choropleth spatial data
            .await(callback);


        function callback(error, csvData, counties, tracts) {

            //place graticule on the map
            setGraticule(map, path);


			//check whether data is loading correctly
			/*console.log(counties);
			console.log(tracts);
			console.log(csvData);*/
			
            //translate counties and tracts TopoJSON
            var waCounties = topojson.feature(counties, counties.objects.tl_2020_us_county_WAstate),
                snohomishTracts = topojson.feature(tracts, tracts.objects.selected_snohomish_tracts).features;

            //add counties countries to map
            var countries = map.append("path")
                .datum(waCounties)
                .attr("class", "countries")
                .attr("d", path);

            //join csv data to GeoJSON enumeration units
            snohomishTracts = joinData(snohomishTracts, csvData);

            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumerationUnits(snohomishTracts, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            //call dropdown to be created
            createDropdown(csvData);
        };

    };

    function setGraticule(map, path) {
        //create graticule generator
        var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines

    };


    function joinData(snohomishTracts, csvData) {
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i = 0; i < csvData.length; i++) {
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.JOIN_ID; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a = 0; a < snohomishTracts.length; a++) {

                var geojsonProps = snohomishTracts[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.JOIN_ID; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey) {

                    //assign all attributes and values
                    attrArray.forEach(function (attr) {
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };

        return snohomishTracts;
    };

    //function to create color scale generator (used colorbrewer2.org)
    function makeColorScale(data) {
        var colorClasses = [
        //"#f6eff7",
		"#FFEFD5",
        "#bdc9e1",
        "#67a9cf",
        "#1c9099",
        "#016c59"
    ];

        //create color scale generator
        var colorScale = d3.scale.threshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i = 0; i < data.length; i++) {
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function (d) {
            return d3.min(d);
        });

        console.log(clusters);
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;
    };

    function setEnumerationUnits(snohomishTracts, map, path, colorScale) {
        //add tracts ("regions") to map
        var regions = map.selectAll(".regions")
            .data(snohomishTracts)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "regions " + d.properties.JOIN_ID;
            })
            .attr("d", path)
            .style("fill", function (d) {
                return choropleth(d.properties, colorScale);
            })
            .on("mouseover", function (d) {
                highlight(d.properties);
            })
            .on("mouseout", function (d) {
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);
        
        //add style descriptor to each path
        var desc = regions.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');

    };

    //function to test for data value and return color
    function choropleth(props, colorScale) {
        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)) {
            return colorScale(val);
        } else {
            return "#CCC";
        };
    };

    //function to create coordinated bar chart
    function setChart(csvData, colorScale) {

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);


        //set bars for each province
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function (a, b) {
                return b[expressed] - a[expressed]
            })
            .attr("class", function (d) {
                return "bar " + d.JOIN_ID;
            })
            .attr("width", chartInnerWidth / csvData.length - 1) //might just be chartWidth?? 
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);

        //add style descriptor to each rect
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 40)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Percent of Tract Pop. with " + expressed);

        //create vertical axis generator
        var yAxis = d3.svg.axis()
            .scale(yScale)
            .orient("left");

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);

    }; //end of setChart


    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData) {
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function () {
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function (d) {
                return d
            })
            .text(function (d) {
                return d
            });
    };

    //dropdown change listener handler
    function changeAttribute(attribute, csvData) {
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var regions = d3.selectAll(".regions")
            .transition()
            .duration(1000)
            .style("fill", function (d) {
                return choropleth(d.properties, colorScale)
            });

        //re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bar")
            //re-sort bars
            .sort(function (a, b) {
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function (d, i) {
                return i * 20
            })
            .duration(500);

        updateChart(bars, csvData.length, colorScale);
    }; //end of changeAttribute()

    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale) {
        //position bars
        bars.attr("x", function (d, i) {
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //size/resize bars
            .attr("height", function (d, i) {
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function (d, i) {
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function (d) {
                return choropleth(d, colorScale);
            });
        //add text to chart title
        var chartTitle = d3.select(".chartTitle")
            .text("Percent of Tract Pop. with " + expressed);
    };
    //function to highlight enumeration units and bars
    function highlight(props) {
        //change stroke
        var selected = d3.selectAll("." + props.JOIN_ID)
            .style("stroke", "blue")
            .style("stroke-width", "2");
        
        setLabel(props);
    };


    //function to reset the element style on mouseout
    function dehighlight(props) {
        var selected = d3.selectAll("." + props.JOIN_ID)
            .style("stroke", function () {
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function () {
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName) {
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };
        
         //remove info label
    d3.select(".infolabel")
        .remove();
    };

    
    //function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "%" + "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.JOIN_ID + "_label")
        .html(labelAttribute);

    var fullTractName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.NAMELSAD);
};
    
    //function to move info label with mouse
function moveLabel(){
    //use coordinates of mousemove event to set label coordinates
    var x = d3.event.clientX + 10,
        y = d3.event.clientY - 75;

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
    
    //function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
    

})();