var moment = Moment.load(); // init momentjs library : MHMchiX6c1bwSqGM1PZiW_PxhMjh3Sh48
var cache = CacheService.getScriptCache(); 



/**********************
* main entry point
* expects the parameters:
* baseDate, offset, callback
* return an object of calendarEvents grouped and ordered by date
***********************/
function doGet(e){
  if(e.parameter.cache){    
   cacheEvents();
   return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
  }
 
  var offset = parseInt(e.parameter.offset); // How many days offset from the baseDate are we looking at.
  var callback = e.parameter.callback; // required for JSONP
  var NumOfDaysToFetch = 7; // how many days of events to fetch
  
  var startDate = moment(e.parameter.baseDate).add(offset, 'days'); 
  var endDate = moment(startDate).add(NumOfDaysToFetch,'days');
  var searchKeys = getDateRange(startDate,endDate,"dddd, MMMM Do"); //creates an array of dates formatted as keys for memcache
 

  
  var returnEvents = {}; // The object to be returned
  
  //pull cached events by searchKey
  var cached = cache.getAll(searchKeys);
  for(var k in cached){
    returnEvents[k] = JSON.parse(cached[k]);
  }
  returnEvents = sortObj(returnEvents); // sort the days, sometimes they can get out of order. 
  
  // If there are no events to render in the NumOfDaysToFetch window. 
  if(Object.getOwnPropertyNames(returnEvents).length < 1){
    returnEvents[formatDate(startDate)] = [{eventName:"Nothing scheduled yet",
                                            startTime:"12:00 AM",
                                            endTime:"12:00 AM",             
                                            allDay: true,           
                                            htmlLink: "http://www.ccsknights.org"
                                           }];
  }
  
  
  return ContentService.createTextOutput(callback+'('+ JSON.stringify(returnEvents)+')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}


/**********************
*
***********************/
function formatDate(date){
  return moment(date).format("dddd, MMMM Do");
}

/**********************
*
***********************/
function formatTime(date){
  return moment(date).format("h:mm a");
}

/**********************
* generates an array of dates between two dates
***********************/
function getDateRange(startDate, endDate, dateFormat) {
  var dates = [],
      end = endDate,
      diff = endDate.diff(startDate, 'days');
  
  if(!startDate.isValid() || !endDate.isValid() || diff <= 0) {
    return;
  }
  
  for(var i = 0; i < diff; i++) {
    dates.push(end.subtract(1,'d').format(dateFormat));
  }
  
  return dates;
  
};

/**********************
*
***********************/
function fetchEvents(startDate, endDate, calendars){
  
  // add calendars in the order you want them to appear
  var calendars = calendars || [
    CalendarApp.getCalendarById('ccsknights.org_u40calbnpa0lk48a4namm1dpao@group.calendar.google.com'),
    CalendarApp.getCalendarById('mastercal@ccsknights.org'),
    CalendarApp.getCalendarById('ccsknights.org_shdda4u0rjh3npnjmd2eb753ck@group.calendar.google.com')
  ];
  
  
  var returnEventList = {},htmlLink,eventDate;  
  for(var calendar in calendars){
    var calendarId = calendars[calendar].getId();
    
    var calendarEvents = calendars[calendar].getEvents(startDate, endDate);
    
    for (var event in calendarEvents){
      eventDate  = formatDate(calendarEvents[event].getStartTime());
      
      try{htmlLink = Calendar.Events.get(calendarId, calendarEvents[event].getId().split('@')[0]).htmlLink;} // Not accessable through the CalandarApp 
      catch(e){ Logger.log(e); htmlLink = "http://www.ccsknights.org"} // I've been getting bad event Ids. Quick fix
      
      // if there is no entry for this date create it.
      if(!(eventDate in returnEventList)){
        returnEventList[eventDate] = [];
      }
      
      
      // all calendarEvents are added by date
      returnEventList[eventDate]
      .push({eventName:calendarEvents[event].getTitle(),
             startTime: formatTime(calendarEvents[event].getStartTime()),
             endTime:formatTime(calendarEvents[event].getEndTime()),             
             allDay:calendarEvents[event].isAllDayEvent(),           
             htmlLink: htmlLink,
             isoDateTime:calendarEvents[event].getStartTime(),
             eventId:calendarEvents[event].getId(),
             eventDesc:calendarEvents[event].getDescription(),
             eventLocation:calendarEvents[event].getLocation()             
            });            
    }
  }
  return returnEventList;
}

/**********************
* not generic, designed for
* this data format
* sorts object in chrono order
***********************/
function sortObj(obj){
  var sortArray = [];
  var retObj = {}
  //Sort the days to ensure they render in order.
  for(var k in obj){
    sortArray.push(obj[k][0].isoDateTime);
  }
  sortArray.sort(function(a,b){return moment(a)-moment(b)})
  .map(function(val){
    var date = formatDate(val);
    if(!(date in retObj)){
      retObj[date] = [];
    }
    retObj[date] = obj[date];
  });
  return retObj;
}


/**********************
*
***********************/
function cacheEvents(){ 
  var startDate = moment().subtract(30, 'days').toDate()
  var endDate = moment(startDate).add(180,'days').toDate();
  var events = fetchEvents(startDate, endDate);
  // cache results
  for(var key in events){
    cache.put(key, JSON.stringify(events[key]),21600);
  }

}

