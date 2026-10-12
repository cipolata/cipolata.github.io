var query = new URLSearchParams(document.location.search);
var data = {};
query.forEach(function (value, key) { data[key] = value; });
var numTeams = parseInt(data.teams);
var teams = new Array();
for (i = 1; i <= numTeams; i++) {
  var t = "team"+i;
  teams[i] = [data['name' + i] || 'Team ' + i, data[t]];
}
teams = teams.filter(function () { return true });
teams.sort(function(a,b) {
    return b[1]-a[1]
});
console.log(teams);

var scores = document.createElement("h2");
s = ""
for (i = 1; i < numTeams; i++){
  s += teams[i][0] + ": " +teams[i][1] + "<br>";
}
scores.innerHTML = s;
scores.classList.add("others-scores")
document.body.appendChild(scores);

document.getElementById("winner-team").innerHTML = teams[0][0];
document.getElementById("winner-score").innerHTML = teams[0][1];