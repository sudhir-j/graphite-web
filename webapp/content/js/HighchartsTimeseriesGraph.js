// wrapper class for rendering graphite json metrics using Highcharts 
function HighchartsTimeseriesGraph(options) {
	this.options = options;
	
}

HighchartsTimeseriesGraph.prototype = {
  create : function create() {
      var chartData = {
		chart: {
			renderTo: 'containerid',
			type: this.options.graphType,
			zoomType: 'xy',
			spacingRight: 20
		},
		title: {
			text: this.options.graphTitle
		},
		subtitle: {
			text: document.ontouchstart === undefined ?
				'Click and drag in the plot area to zoom in' :
				'Drag your finger over the plot to zoom in'
		},
		xAxis: {
			type: 'datetime',
			title: {
				text: null
			}
		},
		yAxis: {
			title: {
				text: ''
			},
			min: 0.0001,
			startOnTick: false,
                        marker: {
				enabled: false
			},
			showFirstLabel: false
		},
		tooltip: {
			pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b><br/>',
		        valueSuffix: ' ms',
                        style : { padding: 10 },
			formatter: function() {
                                        
					var point = this.point;
					return '<span style="color:'+point.series.color+'">'+ point.series.name+'</span>:<br/>' +
						Highcharts.dateFormat('%A %B %e %Y %H:%M', this.x) + '<br/>value: '+ point.y;
				},
			shared: false
		},
		plotOptions: {
			area: {
				fillColor: {
					linearGradient: [0, 0, 0, 300],
					stops: [
						[0, 'rgba(2,0,0,0)'],
						[1, 'rgba(2,0,0,0)']
					]
				},
				lineWidth: 1,
				marker: {
					enabled: false
				},
				shadow: false,
				states: {
					hover: {
						lineWidth: 1
					}
				}
			}
		},

		series: [{name:'test', data:[]}]
	};

	chartData['chart']['renderTo']=this.options.containerId;
        
        var testVar = this.options.data.map( 
            function(series)
            {
                var convertedSeries = { "marker": {"enabled": false}};
                convertedSeries["name"] =series["target"];
                seriesData=series['datapoints'].filter(
                        function(orig) {
                                if(orig[0]!=null) 
                                        return true;
                        });
                
                convertedSeries["data"] = seriesData.map(
                        function(datapoints){
                                datapoints[1]=datapoints[1]*1000; 
                                if(datapoints[0]!=null)
                                { 
                                        datapoints[0] = datapoints[0];
                                }
                                var tmp = datapoints[0]; 
                                datapoints[0]=datapoints[1]; 
                                datapoints[1]=tmp; 
                                return datapoints;
                        });
                 
                 return convertedSeries;
                        
            }); 
        chartData['series'] = testVar;
        
        Highcharts.setOptions({
         global: {
           useUTC: false
         }
        });
	  var chart = new Highcharts.Chart(chartData);
        return chart;
  }
};
