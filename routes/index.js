const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const router = express.Router();

/* GET home page. */
router.get("/", function(req, res, next) {
  res.sendFile(path.join(__dirname + "/public/index.html"));
});

router.get("/update", function(req, res, next) {
  const jsonPath = path.join(__dirname + "/../public/data.json");
  //Update code goes here
  //Year 2016-2019, Month 1-12
  let obj = { year: 2019, month: 1 };

  function sortFunction(a, b) {
    //jobsCount jobsLength maxLength minLength jobsFinance jobsMass maxMass
    return jobsByUser[b].jobsCount - jobsByUser[a].jobsCount;
  }

  const instance = axios.create({
    baseURL: "https://api.vtlog.net/v1",
    timeout: 10000,
    headers: { "X-API-KEY": "A46A7953ED857401628A76246BF7C90EB5703FE5D4237EAB" }
  });

  obj.month = (obj.month - 1) % 13;
  //const date = new Date();
  // const obj = { year: date.getFullYear(), month: date.getMonth() };
  let startTime = new Date(Date.UTC(obj.year, obj.month));
  let endTime = new Date(Date.UTC(obj.year, obj.month + 1));
  console.log("Start time: " + startTime.toUTCString());
  console.log("End time: " + endTime.toUTCString());
  const jobsByUser = {};
  const jobsByTruck = {};
  const company = {
    companyId: 53,
    jobsCount: 0,
    jobsLength: 0,
    jobsFinance: 0,
    start: startTime.toUTCString(),
    end: endTime.toUTCString()
  };

  startTime = startTime.valueOf() / 1000;
  endTime = endTime.valueOf() / 1000;
  console.log("Please wait, Pikachu is charging Thunder.");
  //Flag set to true if any data is stored
  let someDataFlag = false;
  (async () => {
    let page = 1;
    while (true) {
      const response = await instance.get(
        "companies/" + company.companyId + "/jobs",
        {
          params: { page: page, limit: 99 }
        }
      );
      page++;
      //Flag set to false if no data is found in current call
      let noDataFlag = true;
      response.data.response.jobs.forEach(job => {
        if (
          job.realStartTime > startTime &&
          job.realStartTime < endTime &&
          job.canceled == "0"
        ) {
          someDataFlag = true;
          noDataFlag = false;
          company.jobsCount++;
          if (job.odometer < 0) return;
          company.jobsLength += parseFloat(job.odometer);
          company.jobsFinance += parseFloat(job.fin_result);
          job.username = job.username.replace("[LKW Tr.] ", "");
          const truckName = job.truck_make + " " + job.truck_model;
          if (Object.keys(jobsByUser).includes(job.username)) {
            const {
              jobsCount,
              jobsLength,
              maxLength,
              minLength,
              avgLength,
              jobsFinance,
              jobsMass,
              maxMass,
              minMass,
              fuel,
              mileage,
              lkwVisited,
              trucksUsed,
              peterVisited
            } = jobsByUser[job.username];
            const currentDist = parseFloat(job.odometer);
            jobsByUser[job.username] = {
              jobsCount: jobsCount + 1,
              jobsLength: jobsLength + currentDist,
              minLength: Math.min(minLength, currentDist),
              maxLength: Math.max(maxLength, currentDist),
              avgLength: avgLength,
              jobsFinance: jobsFinance + parseFloat(job.fin_result),
              jobsMass: jobsMass + parseFloat(job.cargo_mass / 1000),
              maxMass: Math.max(maxMass, parseFloat(job.cargo_mass / 1000)),
              minMass: Math.min(minMass, parseFloat(job.cargo_mass / 1000)),
              fuel: fuel + parseFloat(job.fuel),
              mileage: mileage,
              lkwVisited: (function(lkwVisited) {
                if (job.source_company.includes("Lkw")) lkwVisited++;
                if (job.destination_company.includes("Lkw")) lkwVisited++;
                return lkwVisited;
              })(lkwVisited),
              trucksUsed: (function(trucksUsed) {
                if (trucksUsed.indexOf(truckName) === -1)
                  trucksUsed.push(truckName);
                return trucksUsed;
              })(trucksUsed),
              peterVisited: (function(peterVisited) {
                if (job.source_city.includes("Санкт")) peterVisited++;
                if (job.destination_city.includes("Санкт")) peterVisited++;
                return peterVisited;
              })(peterVisited)
            };
          } else {
            jobsByUser[job.username] = {
              jobsCount: 1,
              jobsLength: parseFloat(job.odometer),
              minLength: parseFloat(job.odometer),
              maxLength: parseFloat(job.odometer),
              avgLength: 0,
              jobsFinance: parseFloat(job.fin_result),
              jobsMass: parseFloat(job.cargo_mass / 1000),
              maxMass: parseFloat(job.cargo_mass / 1000),
              minMass: parseFloat(job.cargo_mass / 1000),
              fuel: parseFloat(job.fuel),
              mileage: 0,
              lkwVisited: (function() {
                if (
                  job.source_company.includes("Lkw") ||
                  job.destination_company.includes("Lkw")
                )
                  return 1;
                return 0;
              })(),
              trucksUsed: new Array(truckName),
              peterVisited: (function() {
                if (
                  job.source_city.includes("Санкт") ||
                  job.destination_city.includes("Санкт")
                )
                  return 1;
                return 0;
              })()
            };
          }

          if (Object.keys(jobsByTruck).includes(truckName)) {
            const { jobsCount, users } = jobsByTruck[truckName];
            jobsByTruck[truckName] = {
              jobsCount: jobsCount + 1,
              users: (function(users) {
                if (users.indexOf(job.username) === -1)
                  users.push(job.username);
                return users;
              })(users)
            };
          } else {
            jobsByTruck[truckName] = {
              jobsCount: 1,
              users: new Array(job.username)
            };
          }
        }
      });
      if (someDataFlag && noDataFlag) {
        console.log("Gone till page: " + page);
        break;
      }
    }

    //Sorting final data by count and calculating avg distance
    const jobsByUserOrdered = {};
    Object.keys(jobsByUser)
      .sort(sortFunction)
      .forEach(function(key) {
        jobsByUserOrdered[key] = jobsByUser[key];
        const { jobsCount, jobsLength, fuel } = jobsByUserOrdered[key];
        jobsByUserOrdered[key].avgLength = parseFloat(jobsLength / jobsCount);
        jobsByUserOrdered[key].mileage = parseFloat((fuel * 100) / jobsLength);
        jobsByUserOrdered[key].name = key;
      });

    const jobsByTruckOrdered = {};
    Object.keys(jobsByTruck)
      .sort(function(a, b) {
        return jobsByTruck[b].users.length - jobsByTruck[a].users.length;
      })
      .forEach(function(key) {
        jobsByTruckOrdered[key] = jobsByTruck[key];
      });

    const jobsArray = [];
    Object.keys(jobsByUserOrdered).forEach(function(key) {
      jobsArray.push(jobsByUserOrdered[key]);
    });
    company.usersActive = Object.keys(jobsByUser).length + " Truckers";
    company.avgLength = parseFloat(company.jobsLength / company.jobsCount);
    company.user = jobsArray;
    //company.truck = jobsByTruckOrdered;

    function replacer(key, value) {
      if (Number(value) === value && value % 1 != 0) return parseInt(value);
      return value;
    }
    let data = JSON.stringify(company, replacer, " ");
    res.send(data);
    fs.writeFile(jsonPath, data, function(err) {
      if (err) {
        return console.log(err);
      }
      console.log("Data dumped in data.json");
      console.log("Pikachu used Thunder, it is super effective !!");
    });
  })();
});

module.exports = router;
