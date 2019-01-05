angular
  .module("app", [])
  .controller("ctrl", ctrl);

ctrl.$inject = ["$scope", "$http"];

function ctrl($scope, $http) {

  let ct = this;
  ct.orderByField = "jobsLength";
  ct.reverseSort = true;
  ct.loading = true;

  ct.sortFunction = sortFunction;
  function sortFunction(key) {
    if (ct.orderByField == key) {
      ct.reverseSort = !ct.reverseSort;
    } else {
      ct.orderByField = key;
      ct.reverseSort = true;
    }
  }

  ct.yearData = yearData;
  function yearData() {
    $http.get("./year.json").then(function(result) {
      ct.data = result.data;
    });
  }

  ct.lastMonth = lastMonth;
  function lastMonth() {
    $http.get("./lastMonth.json").then(function(result) {
      ct.data = result.data;
    });
  }

  angular.element(document).ready(function() {
    $http.get("./data.json").then(function(result) {
      ct.data = result.data;
      $http.get("/update").then(function(result){
        ct.data = result.data;
        ct.loading = false;
      })
    });

  });
}
