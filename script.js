// Khởi tạo bản đồ hiển thị tại Cần Thơ
var map = L.map('map').setView([10.045162, 105.746857], 13);

// Thêm lớp bản đồ
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Danh sách các điểm mặc định ở Cần Thơ
var defaults = [
    { name: "Đại học Nam Cần Thơ", coords: [10.031785, 105.774657] },
    { name: "Bến Ninh Kiều", coords: [10.033024, 105.782661] }
];

// Tạo một biểu tượng marker tùy chỉnh cho điểm mặc định (màu cam)
var defaultMarkerIcon = L.icon({
    iconUrl: 'img/marker-pin.png', // URL đến hình ảnh marker màu cam
    iconSize: [50, 50], // Kích thước lớn hơn cho biểu tượng
    iconAnchor: [25, 50], // Điểm neo của biểu tượng
    popupAnchor: [0, -50] // Vị trí mở popup dưới marker
});

// Biến lưu trữ các điểm marker và đường đi
var markers = [];  // Lưu trữ các marker hiện có
var routingControl;  // Đối tượng kiểm soát đường đi
let journeyPolylines = []; // Danh sách các đoạn polyline (không liền kề)

// Thêm các điểm mặc định vào bản đồ với biểu tượng màu cam
defaults.forEach(function(store) {
    // Tạo marker cho điểm mặc định với màu cam và kích thước lớn hơn
    var defaultMarker = L.marker(store.coords, { icon: defaultMarkerIcon }).addTo(map)
        .bindPopup(store.name).openPopup();

    // Thêm marker vào danh sách marker
    markers.push(defaultMarker);
});

// Thêm geocoder control để người dùng có thể tìm kiếm địa chỉ với gợi ý
var geocoder = L.Control.geocoder({
    geocoder: new L.Control.Geocoder.Nominatim({
        geocodingQueryParams: { limit: 5 }, // Giới hạn kết quả gợi ý
    }),
    defaultMarkGeocode: false
}).addTo(map);

var clickedPoints = [];

// Lắng nghe sự kiện tìm kiếm địa chỉ thành công
geocoder.on('markgeocode', function(e) {
    var latlng = e.geocode.center;
    var point = L.latLng(latlng.lat, latlng.lng);
    clickedPoints.push(point);

    // Thêm marker mới cho địa chỉ được chọn
    var newMarker = L.marker(point).addTo(map)
        .bindPopup(e.geocode.name) // Hiển thị tên địa chỉ được tìm kiếm
        .openPopup();

    markers.push(newMarker);

    // Tìm điểm mặc định gần nhất cho địa điểm vừa chọn
    var closestDefault = findClosestDefault(latlng);

    // Kiểm tra nếu có ít nhất một điểm mặc định và một điểm tìm kiếm
    if (markers.length >= 2) {
        // Tạo tuyến đường từ điểm mặc định gần nhất đến địa điểm mới
        if (routingControl) {
            map.removeControl(routingControl); // Xóa tuyến đường cũ
        }

        // Thêm tuyến đường từ điểm mặc định gần nhất đến điểm mới
        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(closestDefault.coords), // Điểm mặc định gần nhất
                point // Điểm mới chọn
            ],
            routeWhileDragging: true,
            lineOptions: {
                styles: [{ className: 'leaflet-routing-line' }]
            }
        }).addTo(map);

        // Lắng nghe sự kiện khi tuyến đường đã được tính toán
        routingControl.on('routesfound', function(e) {
            var routes = e.routes;
            var route = routes[0]; // Chọn tuyến đường đầu tiên (chính)

            // Tạo polyline mới cho tuyến đường này
            var newPolyline = L.polyline(route.coordinates, { color: 'blue', dashArray: '5, 5' }).addTo(map);
            journeyPolylines.push(newPolyline); // Lưu polyline vào danh sách

            // Phóng to vào cả waypoint và đường đi
            map.fitBounds(newPolyline.getBounds()); // Điều chỉnh bản đồ để bao gồm đường mới
        });
    }

    // Cập nhật danh sách hành trình sau khi tìm kiếm thành công
    updateJourneyNames();
});

// Sự kiện click trên bản đồ
map.on('click', function(e) {
    var latlng = e.latlng;
    var closestDefault = findClosestDefault(latlng); // Tìm điểm mặc định gần nhất

    reverseGeocode(latlng, function(locationName) {
        // Tạo marker mới cho địa điểm người dùng đã chọn
        var newMarker = L.marker(latlng).addTo(map)
            .bindPopup(locationName).openPopup();

        markers.push(newMarker); // Lưu marker mới vào danh sách

        // Chỉ vẽ lại lịch sử khi có ít nhất 2 marker
        if (markers.length >= 2) {
            // Lấy waypoint cho tuyến đường từ điểm mặc định gần nhất đến điểm mới
            var waypoints = [
                L.latLng(closestDefault.coords), // Điểm mặc định gần nhất
                newMarker.getLatLng() // Điểm mới
            ];

            // Xóa routingControl cũ nếu có
            if (routingControl) {
                map.removeControl(routingControl);
            }

            // Tạo routingControl với waypoint từ điểm mặc định gần nhất
            routingControl = L.Routing.control({
                waypoints: waypoints,
                routeWhileDragging: true,
                lineOptions: {
                    styles: [{ className: 'leaflet-routing-line' }]
                }
            }).addTo(map);

            // Lắng nghe sự kiện khi tuyến đường đã được tính toán
            routingControl.on('routesfound', function(e) {
                var routes = e.routes;
                var route = routes[0]; // Chọn tuyến đường đầu tiên (chính)

                // Tạo polyline mới cho tuyến đường này
                var newPolyline = L.polyline(route.coordinates, { color: 'blue', dashArray: '5, 5' }).addTo(map);
                journeyPolylines.push(newPolyline); // Lưu polyline vào danh sách

                // Phóng to vào cả waypoint và đường đi
                map.fitBounds(newPolyline.getBounds()); // Điều chỉnh bản đồ để bao gồm đường mới
            });
        }

        updateJourneyNames();
    });

    // Kiểm tra và không tạo marker mới cho điểm mặc định
    // Chúng ta không cần tạo marker cho điểm mặc định nữa, chỉ cần sử dụng marker đã có
});

// Hàm reverse geocoding sử dụng Nominatim để lấy tên địa điểm từ tọa độ
function reverseGeocode(latlng, callback) {
    var url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latlng.lat}&lon=${latlng.lng}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.address) {
                let name = data.display_name || `Không tìm thấy địa điểm<br>(${latlng.lat}, ${latlng.lng})`;
                callback(name);
            } else {
                callback(`Không tìm thấy địa điểm<br>(${latlng.lat}, ${latlng.lng})`);
            }
        })
        .catch(err => {
            console.error(err);
            callback(`Lỗi khi lấy dữ liệu<br>(${latlng.lat}, ${latlng.lng})`);
        });
}

// Hàm để tìm điểm mặc định gần nhất
function findClosestDefault(latlng) {
    let closestPoint = defaults[0];
    let minDistance = getDistance(latlng, L.latLng(defaults[0].coords));

    defaults.forEach(function(store) {
        let distance = getDistance(latlng, L.latLng(store.coords));
        if (distance < minDistance) {
            closestPoint = store;
            minDistance = distance;
        }
    });

    return closestPoint;
}

// Hàm tính khoảng cách giữa hai điểm
function getDistance(latlng1, latlng2) {
    return latlng1.distanceTo(latlng2); // Sử dụng phương thức có sẵn của Leaflet
}

// Hàm để cập nhật danh sách tên các vị trí
function updateJourneyNames() {
    var journeyNamesElement = document.getElementById("journeyNames");
    journeyNamesElement.innerHTML = ''; // Xóa nội dung cũ

    if (markers.length === 0) {
        journeyNamesElement.innerHTML = "Chưa có hành trình.";
    } else {
        // Tạo bảng HTML
        const table = document.createElement('table');
        table.style.width = '100%';
        table.border = '1';

        // Tạo hàng tiêu đề
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Điểm bắt đầu (Điểm click)</th>
            <th>Điểm kết thúc (Điểm mặc định gần nhất)</th>
            <th>Tuyến đường</th>`;
        table.appendChild(headerRow);

        // Lặp qua các marker đã thêm bởi người dùng (bỏ qua các điểm mặc định)
        markers.slice(2).forEach((marker, index) => {
            // Lấy tọa độ của điểm đã click (bắt đầu từ vị trí thứ 3 trở đi, tức chỉ các điểm do người dùng thêm)
            var startLatLng = marker.getLatLng();

            // Tìm điểm mặc định gần nhất cho điểm này
            var closestDefault = findClosestDefault(startLatLng);

            const row = document.createElement('tr');

            // Cột "Điểm bắt đầu" (tọa độ click)
            const startCell = document.createElement('td');
            startCell.style.textAlign = 'center';
            startCell.textContent = marker.getPopup().getContent() || `(${startLatLng.lat}, ${startLatLng.lng})`;

            // Hover vào ô "Điểm bắt đầu" để hiển thị popup và căn giữa bản đồ
            startCell.addEventListener('mouseover', () => {
                map.panTo(marker.getLatLng());
                marker.openPopup();
            });
            startCell.addEventListener('mouseout', () => {
                marker.closePopup();
                panToLastMarker();
            });

            // Cột "Điểm kết thúc" (điểm mặc định gần nhất)
            const endCell = document.createElement('td');
            endCell.style.textAlign = 'center';
            endCell.textContent = closestDefault.name || `(${closestDefault.coords[0]}, ${closestDefault.coords[1]})`;

            // Hover vào ô "Điểm kết thúc" để hiển thị popup của điểm gần nhất
            endCell.addEventListener('mouseover', () => {
                const nearestMarker = L.marker(closestDefault.coords).addTo(map).bindPopup(closestDefault.name).openPopup();
                map.panTo(nearestMarker.getLatLng());
            });
            endCell.addEventListener('mouseout', () => {
                panToLastMarker();
            });

            // Cột "Tuyến đường" hiển thị khoảng cách giữa hai điểm
            const routeCell = document.createElement('td');
            routeCell.style.textAlign = 'center';

            var distance = startLatLng.distanceTo(L.latLng(closestDefault.coords)); // Tính khoảng cách
            var distanceKm = (distance / 1000).toFixed(2); // Đổi sang km

            routeCell.textContent = `Khoảng cách: ${distanceKm} km`;

            row.appendChild(startCell);
            row.appendChild(endCell);
            row.appendChild(routeCell);
            table.appendChild(row);
        });

        // Thêm bảng vào danh sách lịch sử
        journeyNamesElement.appendChild(table);
    }
}

// Hàm căn chỉnh lại bản đồ sau khi hover
function panToLastMarker() {
    if (markers.length > 0) {
        map.panTo(markers[markers.length - 1].getLatLng());
    }
}