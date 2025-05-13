// api/index.js
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json()); // Để xử lý JSON trong POST requests

const GSM_ARENA_BASE_URL = "https://www.gsmarena.com/";

// Hàm lấy chi tiết thiết bị
async function getDeviceDetail(key) {
  try {
    const response = await axios.get(`${GSM_ARENA_BASE_URL}${key}.php`, {
      timeout: 10000,
    });
    if (response.status !== 200) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const $ = cheerio.load(response.data);

    const deviceName = $(`h1[class^=specs-phone-name-title]`).text().trim();
    const deviceImage =
      $(`div[class^=specs-photo-main] a img`).attr(`src`) || "";
    const displaySize =
      $(`span[data-spec^=displaysize-hl]`).text().trim() ||
      $(`div[data-spec^=displaysize-hl]`).text().trim();
    const displayRes = $(`div[data-spec^=displayres-hl]`).text().trim();
    const accentCamera =
      $(`.accent-camera`).text().trim() ||
      $(`div[data-spec^=camerapixels-hl]`).text().trim();
    const videoPixels =
      $(`div[data-spec^=videopixels-hl]`).text().trim() || "1080p";
    const ramSize =
      $(`.accent-expansion`).text().trim() ||
      $(`div[data-spec^=internalmemory-hl]`)
        .text()
        .match(/(\d+\/\d+GB RAM)/)?.[0] ||
      "";
    const chipset = $(`div[data-spec^=chipset-hl]`).text().trim();
    const battery =
      $(`.accent-battery`).text().trim() ||
      $(`div[data-spec^=batterycapacity-hl]`).text().trim();
    const batteryType =
      $(`div[data-spec^=battype-hl]`).text().trim() ||
      $(`div[data-spec^=charging-hl]`).text().trim();
    const releaseDate = $(`span[data-spec^=released-hl]`).text().trim();
    const body = $(`span[data-spec^=body-hl]`).text().trim();
    const os = $(`span[data-spec^=os-hl]`).text().trim();
    const storage =
      $(`span[data-spec^=storage-hl]`).text().trim() ||
      $(`div[data-spec^=internalmemory-hl]`).text().trim();
    const comment = $(`p[data-spec^=comment]`).text().trim();

    const specList = getSpec($);
    const priceList = getPrice($);
    const otherInformation = getOtherInformation($);
    const pictureList = await getPicture(key, $);

    return {
      key,
      device_name: deviceName,
      device_image: deviceImage,
      display_size: displaySize,
      display_res: displayRes,
      camera: accentCamera,
      video: videoPixels,
      ram: ramSize,
      chipset,
      battery,
      batteryType,
      release_date: releaseDate,
      body,
      os_type: os,
      storage,
      comment,
      more_specification: specList,
      prices: priceList,
      pictures: pictureList,
      more_information: otherInformation,
    };
  } catch (error) {
    console.error(`Error in getDeviceDetail for ${key}: ${error.message}`);
    return null;
  }
}

// Hàm lấy thông số kỹ thuật
function getSpec($, deviceArray = [1]) {
  const specList = [];
  $(`div[id^=specs-list] table`).each(function (tableIndex, specTable) {
    const _specList = [];
    let specTitle = $(specTable).find(`th`).text().trim();

    $(specTable)
      .find(`tbody tr`)
      .each(function (trIndex, tr) {
        let subTitle = $(tr).find(`td.ttl`).text().trim();
        let subSpecList = [];
        $(tr)
          .find(`td.nfo`)
          .each(function (tdIndex, td) {
            let specValue = $(td).text().trim();
            if (
              specValue.toLowerCase() ===
                `compare photo / compare video`.toLowerCase() ||
              !specValue
            ) {
              specValue = "";
            }
            subSpecList.push(specValue);
          });
        if (subTitle && subSpecList.length > 0) {
          _specList.push({
            title: subTitle,
            data: deviceArray.map((_, index) => subSpecList[index] || ""),
          });
        }
      });

    if (specTitle && _specList.length > 0) {
      specList.push({
        title: specTitle,
        data: _specList,
      });
    }
  });
  return specList;
}

// Hàm lấy giá
function getPrice($) {
  const priceList = {};
  $(`div[class^=pricing-scroll-container] div[class^=pricing]`).each(function (
    pIndex,
    pricing
  ) {
    const key = $(pricing).find(`span`).text().trim();
    const tempPrice = [];
    $(pricing)
      .find(`ul li`)
      .each(function (liIndex, li) {
        tempPrice.push({
          shop_image: $(li).find(`img`).attr(`src`) || "",
          price: $(li).find(`a`).text().trim(),
          buy_url: $(li).find(`a`).attr(`href`) || "",
        });
      });
    if (key && tempPrice.length > 0) {
      priceList[key] = tempPrice;
    }
  });
  return priceList;
}

// Hàm lấy thông tin liên quan
function getOtherInformation($) {
  const otherInformation = {};
  $(`div[class^=module]`).each(function (_, div) {
    let title = $(div).find(`h4[class^=section-heading]`).text().trim();
    const tempList = [];
    $(div)
      .find(`ul li`)
      .each(function (_, li) {
        const deviceLink = $(li).find(`a`).attr(`href`) || "";
        const keyMatch = deviceLink.match(/\/([^\/]+)-(\d+)\.php$/);
        const key = keyMatch ? `${keyMatch[1]}-${keyMatch[2]}` : "";
        if (key) {
          tempList.push({
            device_name: $(li).find(`a`).text().trim(),
            device_image: $(li).find(`img`).attr(`src`) || "",
            key,
          });
        }
      });
    if (title.toLowerCase().includes(`related`)) {
      title = `Related Devices`;
    } else if (title.toLowerCase().includes(`popular`)) {
      title = title;
    } else {
      title = "";
    }
    if (title && tempList.length > 0) {
      otherInformation[title] = tempList;
    }
  });
  return otherInformation;
}

// Hàm lấy danh sách ảnh
async function getPicture(key, $mainPage = null) {
  const pictureList = [];

  // Lấy ảnh từ trang chính
  if ($mainPage) {
    $mainPage(`div#pictures a img`).each(function (_, img) {
      let imgURL = $(img).attr(`src`) || $(img).attr(`data-src`) || "";
      if (imgURL && !pictureList.includes(imgURL)) {
        pictureList.push(imgURL);
      }
    });
  }

  // Lấy ảnh từ trang pictures
  try {
    const keyArray = key.split("-");
    const response = await axios.get(
      `${GSM_ARENA_BASE_URL}${keyArray[0]}-pictures-${keyArray[1]}.php`,
      { timeout: 10000 }
    );
    if (response.status === 200) {
      const $ = cheerio.load(response.data);
      $(`div[id^=pictures-list] img`).each(function (_, img) {
        let imgURL = $(img).attr(`src`) || $(img).attr(`data-src`) || "";
        if (imgURL && !pictureList.includes(imgURL)) {
          pictureList.push(imgURL);
        }
      });
    }
  } catch (error) {
    console.error(`Error in getPicture for ${key}: ${error.message}`);
  }

  return pictureList;
}

// Hàm lấy danh sách thương hiệu
async function getBrands() {
  try {
    const response = await axios.get(`${GSM_ARENA_BASE_URL}makers.php3`);
    const $ = cheerio.load(response.data);
    const brands = [];

    $("div.st-text table td").each(function () {
      const brandName = $(this).find("a").text().trim();
      const brandUrl = $(this).find("a").attr("href");
      const deviceCount = $(this).find("span").text().trim();

      if (brandName && brandUrl) {
        brands.push({
          name: brandName,
          url: `${GSM_ARENA_BASE_URL}${brandUrl}`,
          deviceCount,
        });
      }
    });

    return brands;
  } catch (error) {
    console.error(`Error in getBrands: ${error.message}`);
    throw error;
  }
}

// Hàm lấy danh sách thiết bị theo thương hiệu
async function getDevicesByBrand(brandUrl) {
  try {
    const response = await axios.get(brandUrl);
    const $ = cheerio.load(response.data);
    const devices = [];

    $("div.makers ul li").each(function () {
      const deviceName = $(this).find("a").text().trim();
      const deviceUrl = $(this).find("a").attr("href");
      const deviceImage = $(this).find("img").attr("src");

      if (deviceName && deviceUrl) {
        devices.push({
          name: deviceName,
          url: `${GSM_ARENA_BASE_URL}${deviceUrl}`,
          image: deviceImage,
        });
      }
    });

    return devices;
  } catch (error) {
    console.error(`Error in getDevicesByBrand: ${error.message}`);
    throw error;
  }
}

// Endpoint chính
app.all("/", async (req, res) => {
  let params;

  try {
    params = req.method === "POST" ? req.body : req.query;
  } catch (error) {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }

  const action = params.action || "brands";

  try {
    switch (action) {
      case "brands":
        const brands = await getBrands();
        return res.json(brands);
      case "devices":
        if (params.brandUrl) {
          const devices = await getDevicesByBrand(params.brandUrl);
          return res.json(devices);
        } else {
          return res.status(400).json({ error: "Missing brandUrl parameter" });
        }
      case "details":
        if (params.deviceUrl) {
          const keyMatch = params.deviceUrl.match(/\/([^\/]+)-(\d+)\.php$/);
          const key = keyMatch ? `${keyMatch[1]}-${keyMatch[2]}` : null;
          if (key) {
            const details = await getDeviceDetail(key);
            if (details) {
              return res.json(details);
            } else {
              return res
                .status(404)
                .json({ error: "Device not found or invalid response" });
            }
          } else {
            return res.status(400).json({ error: "Invalid deviceUrl format" });
          }
        } else {
          return res.status(400).json({ error: "Missing deviceUrl parameter" });
        }
      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error(`Error in API: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = app;
