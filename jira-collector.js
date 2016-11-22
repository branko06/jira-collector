var JTSGWL = {
    common: {
        GET_JSON: function(url) {
            var xhttp = new XMLHttpRequest();
            var json_response;
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    json_response = JSON.parse(this.responseText);
                }
            };
            xhttp.open("GET", url, false);
            xhttp.send();
            return json_response;
        },
        TO_DATE_FORMAT: function (millis) {
            var date = new Date(millis);
            return ''.concat(("0" + (date.getDate())).slice(-2))
                .concat(("0" + (date.getMonth()+1)).slice(-2))
                .concat(date.getFullYear());
        },
        DATE_REGEX: '^20[12][0-9]-(?:0[1-9]|1[0-2])-(?:3[01]|[12][0-9]|0[1-9])$'
    },
    loadWorklogs: function (startDate, endDate, targetUser, projectIds) {
        if (!startDate) {
            alert("start date is not provided!");
            return;
        }
        if (!endDate) {
            alert("end date is not provided!");
            return;
        }
        var url = '/rest/timesheet-gadget/1.0/raw-timesheet.json'
            .concat('?startDate=').concat(startDate)
            .concat('&endDate=').concat(endDate)
            .concat('&sumSubTasks=true');
        if (targetUser) {
            url = url.concat('&targetUser=').concat(targetUser.name);
        }
        if (projectIds) {
            projectIds.forEach(function (e) {url = url.concat('&projectid=').concat(e)});
        }
        return worklogs = JTSGWL.common.GET_JSON(url).worklog;
    },
    getCurrentUser: function () {
        try {
            var loggedUser = JTSGWL.common.GET_JSON('/rest/gadget/1.0/currentUser');
            if (loggedUser) {
                return JTSGWL.common.GET_JSON('/rest/api/2/user/search?username='.concat(loggedUser.username))[0];
            }
        } catch (err) {
            console.log(err.message);
        }
    },
    workedProjectsIds: function (startDate, endDate, currentUser) {
        var issues = JTSGWL.workedIssues(startDate, endDate, currentUser, ['project']);
        return issues.map(function (e) { return e.fields.project.id});

    },
    workedIssues: function (startDate, endDate, currentUser, fields) {
        var url = '/rest/api/2/search?jql=key in workedIssues('
                .concat(startDate).concat(',')
                .concat(endDate).concat(',')
                .concat(currentUser.name).concat(')')
                .concat('&maxResults=1000');
        if(fields) {
            url = url.concat("&fields=").concat(fields.join());
        }
        var result = JTSGWL.common.GET_JSON(url);
        if (result) {
            return result.issues;
        }
    },
    getWorklogForWorkedProjects: function (startDate, endDate, currentUser) {
        var projectIds = JTSGWL.workedProjectsIds(startDate, endDate, currentUser);
        var jiraWorklogs = JTSGWL.loadWorklogs(startDate, endDate, currentUser, projectIds);
        var data = JTSGWL.remapJiraWorklogs(jiraWorklogs);
        return JSON.stringify(data);
    },
    remapJiraWorklogs: function (jiraWorklogs) {
        var data = jiraWorklogs.map(function (e) {
            return e.entries.map(function (ee) {
                var date = JTSGWL.common.TO_DATE_FORMAT(ee.startDate);
                var parentIssue = e.key;
                var hours = ee.timeSpent / 3600;
                return {date: date, parentIssue: parentIssue, hours: hours};
            })
        });
        data = Array.prototype.concat.apply([], data);
        return data.reduce(function (result, element) {
            var date = element.date;
            if (!result[date]) {
                result[date] = [];
            }
            result[date].push({issueId: element.parentIssue, parentIssue: element.parentIssue, hours: element.hours});
            return result;
        }, {});
    },
    loadWorklogsForCurrentUser: function() {
        var startDate = prompt('Enter start date:', 'yyyy-mm-dd');
        if (!startDate || !new RegExp(JTSGWL.common.DATE_REGEX, 'g').test(startDate)) {
            alert("start date is not matching required pattern!");
            console.log("start date is not matching required pattern!", startDate);
            return;
        }
        var endDate = prompt('Enter end date:', 'yyyy-mm-dd');
        if (!endDate || !new RegExp(JTSGWL.common.DATE_REGEX, 'g').test(endDate)) {
            alert("end date is not matching required pattern!");
            console.log("end date is not matching required pattern!", endDate, JTSGWL.common.DATE_REGEX.toString());
            return;
        }
        var currentUser = JTSGWL.getCurrentUser();
        if (!currentUser) {
            alert('Could not find logged in user in jira!');
            console.log('Could not find logged in user in jira!');
            return;
        }
        var json = JTSGWL.getWorklogForWorkedProjects(startDate, endDate, currentUser);
        prompt('Copy this value into DR', json);
    } 
}