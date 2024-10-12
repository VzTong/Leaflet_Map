// Khởi tạo bản đồ hiển thị tại Cần Thơ
var map = L.map('map').setView([10.045162, 105.746857], 13);

// Thêm lớp bản đồ
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Danh sách các điểm mặc định ở Cần Thơ (Đại học Cần Thơ và Bến Ninh Kiều)
var defaults = [
    { name: "Đại học Nam Cần Thơ", coords: [10.031785, 105.774657] },
    { name: "Bến Ninh Kiều", coords: [10.033024, 105.782661] }
];

// Biến lưu trữ các điểm marker và đường đi
var markers = [];  // Lưu trữ các marker hiện có
var routingControl;  // Đối tượng kiểm soát đường đi

// Mảng lưu trữ lịch sử các polyline
let journeyPolylines = []; // Danh sách các đoạn polyline (không liền kề)

// Thêm các điểm mặc định vào bản đồ
defaults.forEach(function(store) {
    var marker = L.marker(store.coords).addTo(map)
        .bindPopup(store.name);
    markers.push(marker);
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

// Hàm tính khoảng cách giữa hai điểm
function getDistance(latlng1, latlng2) {
    return latlng1.distanceTo(latlng2); // Sử dụng phương thức có sẵn của Leaflet
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

// Sự kiện click trên bản đồ
map.on('click', function(e) {
    var latlng = e.latlng;
    var closestDefault = findClosestDefault(latlng); // Tìm điểm mặc định gần nhất

    reverseGeocode(latlng, function(locationName) {
        var newMarker = L.marker(latlng).addTo(map)
            .bindPopup(locationName).openPopup();

        markers.push(newMarker);

        // Chỉ vẽ lại lịch sử khi có điểm mới được thêm
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
});

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

            // Không cần hover cho ô "Tuyến đường"

            // Thêm các ô vào hàng
            row.appendChild(startCell);
            row.appendChild(endCell);
            row.appendChild(routeCell);

            // Thêm hàng vào bảng
            table.appendChild(row);
        });

        journeyNamesElement.appendChild(table);
    }
}

// Hàm tìm điểm mặc định gần nhất
function findClosestDefault(latlng) {
    let closest = defaults[0]; // Giả sử điểm đầu tiên là gần nhất
    let minDistance = latlng.distanceTo(L.latLng(closest.coords)); // Khoảng cách đến điểm đầu tiên

    defaults.forEach(defaultLocation => {
        let distance = latlng.distanceTo(L.latLng(defaultLocation.coords));
        if (distance < minDistance) {
            minDistance = distance;
            closest = defaultLocation; // Cập nhật điểm gần nhất
        }
    });

    return closest; // Trả về điểm mặc định gần nhất
}

// Hàm để căn bản đồ về điểm mới nhất
function panToLastMarker() {
    if (markers.length > 2) { // Đảm bảo có ít nhất một điểm do người dùng thêm
        const lastMarker = markers[markers.length - 1];
        map.panTo(lastMarker.getLatLng());
    }
}

// Hàm để xem lịch sử hành trình
function showJourneyHistory() {
    console.log("Lịch sử hành trình:", journeyPolylines);
}

// Gọi hàm để xem lịch sử hành trình
setTimeout(showJourneyHistory, 10000);
